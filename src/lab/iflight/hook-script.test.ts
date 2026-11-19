/**
 * SPIKE (descartável) — testa o script que roda DENTRO da página do iFlight.
 * Simula a página: fetch falso, ponte `window.mobileApp` falsa, e verifica o que chega no app.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IFLIGHT_LAB_HOOK_SCRIPT } from './hook-script';

type Posted = { detail: Record<string, unknown> };

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]); // "%PDF-1.4\n"

function flush() {
  return new Promise((r) => setTimeout(r, 30));
}

describe('IFLIGHT_LAB_HOOK_SCRIPT', () => {
  let posted: Posted[];
  let realFetch: typeof window.fetch;

  beforeEach(() => {
    posted = [];
    realFetch = window.fetch;
    (window as unknown as { mobileApp: unknown }).mobileApp = {
      postMessage: (m: Posted) => posted.push(m),
    };
    delete (window as unknown as { __escalaxLab?: boolean }).__escalaxLab;
  });

  afterEach(() => {
    window.fetch = realFetch;
    delete (window as unknown as { mobileApp?: unknown }).mobileApp;
    vi.restoreAllMocks();
  });

  function install() {
    new Function(IFLIGHT_LAB_HOOK_SCRIPT)();
  }

  function byType(type: string) {
    return posted.map((p) => p.detail).filter((d) => d.type === type);
  }

  it('instala uma vez só, mesmo injetado de novo', () => {
    install();
    install();
    expect(byType('hook')).toHaveLength(1);
  });

  it('registra a requisição sem vazar valores de token na URL', async () => {
    window.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ duties: [{ flightNo: 'LA9004', dep: 'BSB' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }),
    ) as unknown as typeof window.fetch;
    install();

    await window.fetch('https://iflightla.ibsplc.aero/iflight-crew/api/roster?month=2026-11&access_token=SEGREDO123');
    await flush();

    const net = byType('net');
    expect(net).toHaveLength(1);
    expect(net[0].url).toBe('https://iflightla.ibsplc.aero/iflight-crew/api/roster?month=2026-11&access_token=…');
    expect(JSON.stringify(posted)).not.toContain('SEGREDO123');
    expect(net[0].ct).toBe('application/json');
    expect(net[0].status).toBe(200);
    // só a forma do JSON, nunca os valores
    expect(net[0].shape).toEqual({ duties: 'array[1] de {flightNo,dep}' });
    expect(JSON.stringify(net[0])).not.toContain('LA9004');
  });

  it('captura os bytes quando a resposta é PDF', async () => {
    window.fetch = vi.fn(async () =>
      new Response(PDF_BYTES, { status: 200, headers: { 'content-type': 'application/pdf' } }),
    ) as unknown as typeof window.fetch;
    install();

    await window.fetch('https://iflightla.ibsplc.aero/iflight-crew/report/CrewRosterReport.pdf');
    await flush();

    const pdf = byType('pdf');
    expect(pdf).toHaveLength(1);
    expect(pdf[0].size).toBe(PDF_BYTES.length);
    expect(atob(pdf[0].base64 as string).startsWith('%PDF')).toBe(true);
  });

  it('não chama de PDF uma resposta que só diz ser PDF', async () => {
    window.fetch = vi.fn(async () =>
      new Response('<html>sessão expirada</html>', { status: 200, headers: { 'content-type': 'application/pdf' } }),
    ) as unknown as typeof window.fetch;
    install();

    await window.fetch('https://iflightla.ibsplc.aero/x.pdf');
    await flush();

    expect(byType('pdf')).toHaveLength(0);
    expect(byType('net')[0].note).toBe('content-type PDF mas não começa com %PDF');
  });

  it('o retrato da página aponta erro de login conhecido', async () => {
    document.title = 'Erro';
    document.body.innerHTML = '<p>403. That’s an error. Error: app_not_configured_for_user</p>';
    install();
    await flush();

    const page = byType('page');
    expect(page.length).toBeGreaterThan(0);
    expect(page[0].errorHint).toBe('app_not_configured_for_user');
  });

  it('o retrato lista os itens de menu da escala, mas nunca o conteúdo de campos', async () => {
    document.title = 'iFlight';
    document.body.innerHTML =
      '<a href="#">Roster Calendar</a><button>Roster Report</button><a href="#">Logout</a>' +
      '<input type="password" value="minhasenha">';
    install();
    await flush();

    const page = byType('page')[0];
    expect(page.hits).toEqual(['Roster Calendar', 'Roster Report']);
    expect(JSON.stringify(posted)).not.toContain('minhasenha');
  });
});
