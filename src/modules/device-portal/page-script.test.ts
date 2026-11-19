import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPageScript, buildReplayScript } from './page-script';
import { LATAM_IFLIGHT } from './providers';

type Msg = Record<string, unknown>;

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25]); // "%PDF-1.7\n%"

let posted: Msg[];
let realFetch: typeof window.fetch;

function messages(type: string): Msg[] {
  return posted.filter((m) => m.type === type);
}

async function flush(ms = 30) {
  await new Promise((r) => setTimeout(r, ms));
}

function fakeFetch(body: BodyInit, contentType: string, status = 200) {
  window.fetch = vi.fn(async () => new Response(body, { status, headers: { 'content-type': contentType } })) as unknown as typeof window.fetch;
}

beforeEach(() => {
  posted = [];
  realFetch = window.fetch;
  document.body.innerHTML = '';
  document.title = '';
  delete (window as unknown as Record<string, unknown>).__escalaxPortal;
  delete (window as unknown as Record<string, unknown>).__escalaxOrigFetch;
  (window as unknown as { mobileApp: unknown }).mobileApp = {
    postMessage: (m: { detail: Msg }) => posted.push(m.detail),
  };
});

afterEach(() => {
  window.fetch = realFetch;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('buildPageScript', () => {
  /** O jsdom roda em localhost: para os testes, "localhost" faz o papel do portal. */
  const TEST_PORTAL = { ...LATAM_IFLIGHT, portalHost: /^localhost$/i };
  const run = (autoNav = false, provider = TEST_PORTAL) => new Function(buildPageScript(provider, { autoNav }))();

  it('fora do portal (ex.: login da Microsoft), não navega nem mostra o passo a passo', async () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    const cal = document.createElement('a');
    cal.textContent = 'Roster Calendar';
    cal.addEventListener('click', onClick);
    document.body.appendChild(cal);

    run(true, LATAM_IFLIGHT);
    await vi.advanceTimersByTimeAsync(25_000);

    expect(onClick).not.toHaveBeenCalled();
    expect(document.getElementById('escalax-guide')).toBeNull();
  });

  it('captura o PDF com a requisição que o originou', async () => {
    fakeFetch(PDF, 'application/pdf');
    run();
    await window.fetch('https://iflightla.ibsplc.aero/r', { method: 'POST', body: 'a=1' });
    await flush();

    const pdf = messages('pdf');
    expect(pdf).toHaveLength(1);
    expect(pdf[0].request).toEqual({ method: 'POST', url: 'https://iflightla.ibsplc.aero/r', body: 'a=1' });
    expect(String(pdf[0].base64).startsWith('JVBER')).toBe(true);
    expect(pdf[0].size).toBe(PDF.length);
  });

  it('o mesmo PDF por fetch e por blob vira uma mensagem só', async () => {
    fakeFetch(PDF, 'application/pdf');
    // jsdom não tem createObjectURL; os navegadores têm.
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:teste');
    run();
    await window.fetch('https://iflightla.ibsplc.aero/r');
    URL.createObjectURL(new Blob([PDF], { type: 'application/pdf' }));
    await flush(1800); // a captura sem requisição (blob) só sai após 1,5 s

    expect(messages('pdf')).toHaveLength(1);
    expect(messages('pdf')[0].request).not.toBeNull();
  });

  it('application/pdf sem %PDF não é capturado', async () => {
    fakeFetch('<html>login</html>', 'application/pdf');
    run();
    await window.fetch('https://iflightla.ibsplc.aero/r');
    await flush();

    expect(messages('pdf')).toHaveLength(0);
  });

  it('o selo mostra o passo que o app mandou', async () => {
    run();
    window.dispatchEvent(new CustomEvent('messageFromNative', { detail: { label: 'Lendo sua escala' } }));
    await flush();

    expect(document.getElementById('escalax-status')?.textContent).toContain('Lendo sua escala');
  });

  it('aponta erro de login conhecido', async () => {
    document.body.innerHTML = '<p>403. Error: app_not_configured_for_user</p>';
    run();
    await flush();

    const page = messages('page');
    expect(page.length).toBeGreaterThan(0);
    expect(page[page.length - 1].errorHint).toBe('app_not_configured_for_user');
  });

  it('com autoNav, toca Roster Calendar e depois Roster Report', async () => {
    vi.useFakeTimers();
    const clicks: string[] = [];
    const cal = document.createElement('a');
    cal.textContent = 'Roster Calendar';
    cal.addEventListener('click', () => {
      clicks.push('calendar');
      const rep = document.createElement('button');
      rep.textContent = 'Roster Report';
      rep.addEventListener('click', () => clicks.push('report'));
      document.body.appendChild(rep);
    });
    document.body.appendChild(cal);

    run(true);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(clicks).toEqual(['calendar', 'report']);
  });

  it('sem autoNav, não toca em nada', async () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    const cal = document.createElement('a');
    cal.textContent = 'Roster Calendar';
    cal.addEventListener('click', onClick);
    document.body.appendChild(cal);

    run(false);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(onClick).not.toHaveBeenCalled();
  });

  it('sem achar os botões em 20 s, mostra o passo a passo', async () => {
    vi.useFakeTimers();
    run(true);
    await vi.advanceTimersByTimeAsync(21_000);

    expect(document.getElementById('escalax-guide')?.textContent).toContain(LATAM_IFLIGHT.guideText);
  });
});

/** Formulário que o iFlight cria para gerar o relatório num iframe escondido. */
function reportForm(): HTMLFormElement {
  const form = document.createElement('form');
  form.setAttribute('action', 'sreports/lr/generateCwpRosterReport');
  form.method = 'post';
  form.target = 'iframeTransport';
  for (const [name, value] of [['data', '{"reportConfiguration":{"format":"pdf"}}'], ['_token_', 'tok-123']]) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  return form;
}

describe('buildPageScript — relatório do iFlight', () => {
  const TEST_PORTAL = { ...LATAM_IFLIGHT, portalHost: /^localhost$/i };
  const run = (autoNav = false) => new Function(buildPageScript(TEST_PORTAL, { autoNav }))();
  let nativeSubmit: ReturnType<typeof vi.fn>;
  const realSubmit = HTMLFormElement.prototype.submit;

  beforeEach(() => {
    nativeSubmit = vi.fn();
    HTMLFormElement.prototype.submit = nativeSubmit as unknown as () => void;
  });
  afterEach(() => {
    HTMLFormElement.prototype.submit = realSubmit;
    delete (window as unknown as Record<string, unknown>).angular;
  });

  it('o envio do formulário vira POST + download pelo próprio app, sem o download nativo', async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    window.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push([url, init]);
      if (/generateCwpRosterReport/.test(url)) {
        return new Response('<html><body><span id="reportDataId">cwpCrewRosterReport123</span></body></html>', { headers: { 'content-type': 'text/html' } });
      }
      return new Response(PDF, { headers: { 'content-type': 'application/pdf' } });
    }) as unknown as typeof window.fetch;

    run();
    reportForm().submit();
    await flush();

    expect(nativeSubmit).not.toHaveBeenCalled();
    expect(calls[0][0]).toMatch(/\/sreports\/lr\/generateCwpRosterReport$/);
    expect(calls[0][1]).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(String(calls[0][1]?.body)).toContain('_token_=tok-123');
    expect(calls[1][0]).toMatch(/\/iflight-crew\/web\/sprout\/jewels\/downloadFile\?reportDataId=cwpCrewRosterReport123&format=pdf$/);
    const pdf = messages('pdf');
    expect(pdf).toHaveLength(1);
    expect(pdf[0].request).toEqual({ method: 'POST', url: expect.stringMatching(/generateCwpRosterReport$/) });
  });

  it('se a resposta não trouxer o id do relatório, segue o envio normal da página', async () => {
    fakeFetch('<html>erro</html>', 'text/html');
    run();
    reportForm().submit();
    await flush();

    expect(nativeSubmit).toHaveBeenCalledTimes(1);
    expect(messages('pdf')).toHaveLength(0);
  });

  it('formulário que não é do relatório segue o envio normal, sem fetch', async () => {
    fakeFetch(PDF, 'application/pdf');
    const spy = window.fetch;
    run();
    const form = document.createElement('form');
    form.setAttribute('action', '/logout');
    document.body.appendChild(form);
    form.submit();
    await flush();

    expect(nativeSubmit).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();
  });

  it('depois de navegar até o Roster Report, escolhe PDF e aperta Run sozinho', async () => {
    vi.useFakeTimers();
    const formats = [{ id: 'HTML', text: 'html' }, { id: 'EXCEL', text: 'xlsx' }, { id: 'PDF', text: 'pdf' }];
    const scope = {
      reportFormat: formats,
      cWPRosterWidgetModel: { outputFormat: null as unknown },
      $apply: (fn: () => void) => fn(),
    };
    (window as unknown as { angular: unknown }).angular = { element: () => ({ scope: () => scope }) };
    const runs: unknown[] = [];
    const cal = document.createElement('a');
    cal.textContent = 'Roster Calendar';
    cal.addEventListener('click', () => {
      const rep = document.createElement('button');
      rep.textContent = 'Roster Report';
      rep.addEventListener('click', () => {
        const form = document.createElement('form');
        form.setAttribute('name', 'rosterReportForm');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('ng-click', 'runRosterReport()');
        btn.textContent = 'Run';
        btn.addEventListener('click', () => runs.push(scope.cWPRosterWidgetModel.outputFormat));
        form.appendChild(btn);
        document.body.appendChild(form);
      });
      document.body.appendChild(rep);
    });
    document.body.appendChild(cal);

    run(true);
    await vi.advanceTimersByTimeAsync(8_000);
    // Primeiro espera o JSON da escala (mais completo); o PDF é a reserva.
    expect(runs).toEqual([]);
    await vi.advanceTimersByTimeAsync(14_000);

    // Aqui o Run não pede o relatório, então o script ainda tenta de novo depois de 4 s.
    expect(runs.length).toBeGreaterThanOrEqual(1);
    expect(runs[0]).toEqual({ id: 'PDF', text: 'pdf' });
  });
});

/** XHR de mentira: o script do portal embrulha o protótipo dele como faria no Angular real. */
class FakeXHR {
  responseURL = '';
  responseType = '';
  responseText = '';
  response: unknown = '';
  private listeners: Array<() => void> = [];
  private headers: Record<string, string> = {};
  open(_m: string, u: string) { this.responseURL = new URL(u, 'http://localhost').href; }
  setRequestHeader() {}
  addEventListener(name: string, fn: () => void) { if (name === 'load') this.listeners.push(fn); }
  getResponseHeader(k: string) { return this.headers[k.toLowerCase()] ?? null; }
  send() {
    this.headers['content-type'] = 'application/json';
    this.responseText = JSON.stringify({ model: { cWPRosterWidgetModel: { cWPCrewRosterDayReportDTO: [{ itemCode: 'DO' }] } } });
    this.response = this.responseText;
    setTimeout(() => this.listeners.forEach((fn) => fn()), 0);
  }
}

describe('buildPageScript — escala pedida direto ao iFlight', () => {
  const TEST_PORTAL = { ...LATAM_IFLIGHT, portalHost: /^localhost$/i };
  const ROWS = { model: { cWPRosterWidgetModel: { cWPCrewRosterDayReportDTO: [{ itemCode: 'DO' }, { itemCode: 'ASB' }] } } };
  afterEach(() => { delete (window as unknown as Record<string, unknown>).angular; });

  function fakeAngular(post: ReturnType<typeof vi.fn>) {
    const injector = { get: (name: string) => (name === '$http' ? { post } : null) };
    (window as unknown as { angular: unknown }).angular = { element: () => ({ injector: () => injector }) };
  }

  it('pede a escala do mês pelo $http da própria página e manda para o app', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-19T15:00:00') });
    const post = vi.fn(async () => ({ status: 200, data: ROWS }));
    fakeAngular(post);
    new Function(buildPageScript(TEST_PORTAL, { autoNav: true }))();
    await vi.advanceTimersByTimeAsync(1_500);

    expect(post).toHaveBeenCalledWith('loadRosterReport', {
      cWPRosterReportSearchDTO: {
        periodFromDate: '2026-11-01T00:00:00.0',
        periodToDate: '2026-11-30T00:00:00.0',
        searchActualTimings: true,
        displayLocalTimings: true,
      },
    });
    const msgs = messages('roster-json');
    expect(msgs).toHaveLength(1);
    expect(JSON.parse(String(msgs[0].text))).toEqual(ROWS);
  });

  it('enquanto o iFlight ainda não liberou (403), tenta de novo', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-19T15:00:00') });
    const post = vi.fn()
      .mockRejectedValueOnce({ status: 403 })
      .mockResolvedValueOnce({ status: 200, data: ROWS });
    fakeAngular(post);
    new Function(buildPageScript(TEST_PORTAL, { autoNav: true }))();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(post).toHaveBeenCalledTimes(2);
    expect(messages('roster-json')).toHaveLength(1);
  });

  it('fora do portal (login), não pede nada', async () => {
    vi.useFakeTimers();
    const post = vi.fn(async () => ({ status: 200, data: ROWS }));
    fakeAngular(post);
    new Function(buildPageScript(LATAM_IFLIGHT, { autoNav: true }))();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(post).not.toHaveBeenCalled();
  });
});

describe('buildPageScript — escala em JSON do iFlight', () => {
  const TEST_PORTAL = { ...LATAM_IFLIGHT, portalHost: /^localhost$/i };
  const realXHR = window.XMLHttpRequest;
  afterEach(() => { window.XMLHttpRequest = realXHR; });

  it('a resposta do loadRosterReport (XHR do Angular) vai inteira para o app', async () => {
    window.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
    new Function(buildPageScript(TEST_PORTAL, { autoNav: false }))();
    const x = new window.XMLHttpRequest();
    x.open('POST', '/iflight-crew/web/loadRosterReport');
    x.send('{}');
    await flush();

    const msgs = messages('roster-json');
    expect(msgs).toHaveLength(1);
    expect(JSON.parse(String(msgs[0].text)).model.cWPRosterWidgetModel.cWPCrewRosterDayReportDTO).toHaveLength(1);
  });

  it('403 em HTML logo após o login não vira escala (e não encerra as tentativas)', async () => {
    let forbidden = true;
    class Switchable extends FakeXHR {
      send() {
        super.send();
        if (forbidden) {
          this.responseText = '<!DOCTYPE html><span hidden="true">403</span>User do not have permission';
          this.response = this.responseText;
        }
      }
    }
    window.XMLHttpRequest = Switchable as unknown as typeof XMLHttpRequest;
    new Function(buildPageScript(TEST_PORTAL, { autoNav: false }))();
    const bad = new window.XMLHttpRequest();
    bad.open('POST', '/iflight-crew/web/loadRosterReport');
    bad.send('{}');
    await flush();
    expect(messages('roster-json')).toHaveLength(0);

    forbidden = false;
    const good = new window.XMLHttpRequest();
    good.open('POST', '/iflight-crew/web/loadRosterReport');
    good.send('{}');
    await flush();
    expect(messages('roster-json')).toHaveLength(1);
  });

  it('outras respostas JSON não são enviadas', async () => {
    window.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
    new Function(buildPageScript(TEST_PORTAL, { autoNav: false }))();
    const x = new window.XMLHttpRequest();
    x.open('POST', '/iflight-crew/web/getRosterCalendarForCalendarPeriod');
    x.send('{}');
    await flush();

    expect(messages('roster-json')).toHaveLength(0);
  });
});

describe('buildReplayScript', () => {
  it('refaz a requisição aprendida e envia o PDF', async () => {
    fakeFetch(PDF, 'application/pdf');
    new Function(buildReplayScript({ method: 'GET', url: 'https://iflightla.ibsplc.aero/r' }))();
    await flush();

    expect(messages('pdf')).toHaveLength(1);
    expect(window.fetch).toHaveBeenCalledWith('https://iflightla.ibsplc.aero/r', expect.objectContaining({ method: 'GET', credentials: 'include' }));
  });

  it('se não vier PDF, avisa replay-failed', async () => {
    fakeFetch('<html>login</html>', 'text/html');
    new Function(buildReplayScript({ method: 'GET', url: 'https://iflightla.ibsplc.aero/r' }))();
    await flush();

    expect(messages('replay-failed')).toEqual([expect.objectContaining({ type: 'replay-failed', status: 200, reason: 'not_pdf' })]);
  });
});
