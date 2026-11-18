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
