import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PdfImportResult } from '@/lib/pdf-import';

const h = vi.hoisted(() => {
  const listeners = new Map<string, Set<(e: unknown) => void>>();
  return {
    listeners,
    openWebView: vi.fn(async (_o: Record<string, unknown>) => ({ id: 'w1' })),
    executeScript: vi.fn(async (_o: { code: string }) => undefined),
    postMessage: vi.fn(async (_o: unknown) => undefined),
    close: vi.fn(async () => undefined),
    clearAllCookies: vi.fn(async () => undefined),
    emit(name: string, data: unknown) {
      for (const fn of [...(listeners.get(name) ?? [])]) fn(data);
    },
  };
});

vi.mock('@capgo/inappbrowser', () => ({
  ToolBarType: { COMPACT: 'compact' },
  InAppBrowser: {
    openWebView: h.openWebView,
    executeScript: h.executeScript,
    postMessage: h.postMessage,
    close: h.close,
    clearAllCookies: h.clearAllCookies,
    addListener: async (name: string, fn: (e: unknown) => void) => {
      if (!h.listeners.has(name)) h.listeners.set(name, new Set());
      h.listeners.get(name)!.add(fn);
      return { remove: async () => void h.listeners.get(name)?.delete(fn) };
    },
  },
}));

import { connectPortal, resetPortal, syncPortal, type PortalStep } from './portal-session';
import { LATAM_IFLIGHT } from './providers';
import { loadPortalState, savePortalState } from './session-store';

const PDF_B64 = 'JVBERi0xLjcK'; // "%PDF-1.7\n"
const REQUEST = { method: 'POST', url: 'https://iflightla.ibsplc.aero/r', body: 'a=1' };
const ok = { success: true, error: null, parsedCount: 12, insertedCount: 12, duplicate: false } as unknown as PdfImportResult;

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

function deps(result: PdfImportResult = ok) {
  return {
    importPdf: vi.fn(async (_n: string, _b: ArrayBuffer) => result),
    now: () => new Date('2026-11-18T16:00:00.000Z'),
    settleMs: 0,
  };
}

beforeEach(() => {
  localStorage.clear();
  h.listeners.clear();
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

describe('connectPortal', () => {
  it('login → portal → PDF: importa, guarda a sessão e o caminho aprendido', async () => {
    const d = deps();
    const steps: PortalStep[] = [];
    const p = connectPortal(LATAM_IFLIGHT, d, (s) => steps.push(s));
    await tick();

    expect(h.openWebView).toHaveBeenCalledWith(expect.objectContaining({ url: LATAM_IFLIGHT.startUrl, title: 'iFlight — LATAM' }));
    expect(h.openWebView.mock.calls[0][0]).not.toHaveProperty('hidden');
    h.emit('urlChangeEvent', { url: 'https://accounts.google.com/signin' });
    h.emit('urlChangeEvent', { url: 'https://iflightla.ibsplc.aero/iflight-crew/web/home' });
    h.emit('messageFromWebview', { detail: { type: 'pdf', base64: PDF_B64, size: 9, request: REQUEST } });

    await expect(p).resolves.toEqual({ kind: 'imported', parsedCount: 12, insertedCount: 12, duplicate: false });
    expect(steps).toEqual(['conectando', 'lendo', 'salvando', 'pronto']);
    expect(d.importPdf).toHaveBeenCalledTimes(1);
    expect(d.importPdf.mock.calls[0][1].byteLength).toBe(9);
    expect(h.close).toHaveBeenCalled();
    expect(loadPortalState('latam')).toEqual({
      status: 'saved',
      lastSyncAt: '2026-11-18T16:00:00.000Z',
      learned: REQUEST,
      lastError: null,
    });
  });

  it('fechar a tela antes do PDF é "cancelled" e não muda o estado', async () => {
    const p = connectPortal(LATAM_IFLIGHT, deps(), () => {});
    await tick();
    h.emit('closeEvent', { url: 'https://accounts.google.com/signin' });

    await expect(p).resolves.toEqual({ kind: 'cancelled' });
    expect(loadPortalState('latam').status).toBe('never');
  });

  it('fechar depois de um erro de login devolve o erro', async () => {
    const p = connectPortal(LATAM_IFLIGHT, deps(), () => {});
    await tick();
    h.emit('messageFromWebview', { detail: { type: 'page', url: 'x', title: '403', errorHint: 'app_not_configured_for_user', navFound: false } });
    h.emit('closeEvent', {});

    const r = await p;
    expect(r.kind).toBe('error');
    expect(r.kind === 'error' && r.message).toContain('app_not_configured_for_user');
  });

  it('o mesmo PDF chegando duas vezes importa uma vez só', async () => {
    const d = deps();
    const p = connectPortal(LATAM_IFLIGHT, d, () => {});
    await tick();
    const msg = { detail: { type: 'pdf', base64: PDF_B64, size: 9, request: REQUEST } };
    h.emit('messageFromWebview', msg);
    h.emit('messageFromWebview', msg);
    await p;

    expect(d.importPdf).toHaveBeenCalledTimes(1);
  });

  it('se o leitor recusar o PDF: erro, tela fechada, sessão não vira "saved"', async () => {
    const d = deps({ success: false, error: 'Formato não reconhecido' } as unknown as PdfImportResult);
    const p = connectPortal(LATAM_IFLIGHT, d, () => {});
    await tick();
    h.emit('messageFromWebview', { detail: { type: 'pdf', base64: PDF_B64, size: 9, request: REQUEST } });

    await expect(p).resolves.toEqual({ kind: 'error', message: 'Formato não reconhecido' });
    expect(h.close).toHaveBeenCalled();
    expect(loadPortalState('latam').status).toBe('never');
  });

  it('PDF baixado pelo próprio navegador também é importado', async () => {
    const realFetch = window.fetch;
    window.fetch = vi.fn(async () => new Response(Uint8Array.from(atob(PDF_B64), (c) => c.charCodeAt(0)))) as unknown as typeof window.fetch;
    try {
      const d = deps();
      const p = connectPortal(LATAM_IFLIGHT, d, () => {});
      await tick();
      h.emit('downloadCompleted', { path: '/cache/CrewRosterReport.pdf', fileName: 'CrewRosterReport.pdf', mimeType: 'application/pdf', localUrl: 'file:///cache/CrewRosterReport.pdf', handledBy: 'inAppBrowser' });

      await expect(p).resolves.toMatchObject({ kind: 'imported' });
      expect(loadPortalState('latam').learned).toBeNull();
    } finally {
      window.fetch = realFetch;
    }
  });
});

describe('syncPortal', () => {
  it('sem caminho aprendido pede para conectar, sem abrir nada', async () => {
    await expect(syncPortal(LATAM_IFLIGHT, deps(), () => {})).resolves.toEqual({ kind: 'needs_connect' });
    expect(h.openWebView).not.toHaveBeenCalled();
  });

  it('com sessão salva: abre escondido, refaz a requisição e importa', async () => {
    savePortalState('latam', { status: 'saved', learned: REQUEST });
    const d = deps();
    const p = syncPortal(LATAM_IFLIGHT, d, () => {});
    await tick();

    expect(h.openWebView).toHaveBeenCalledWith(expect.objectContaining({ url: LATAM_IFLIGHT.startUrl, hidden: true }));
    h.emit('urlChangeEvent', { url: 'https://iflightla.ibsplc.aero/iflight-crew/web/home' });
    h.emit('browserPageLoaded', {});
    await tick();
    expect(h.executeScript).toHaveBeenCalledWith(expect.objectContaining({ code: expect.stringContaining('https://iflightla.ibsplc.aero/r') }));
    h.emit('messageFromWebview', { detail: { type: 'pdf', base64: PDF_B64, size: 9, request: REQUEST } });

    await expect(p).resolves.toMatchObject({ kind: 'imported' });
    expect(d.importPdf).toHaveBeenCalledTimes(1);
    expect(loadPortalState('latam').lastSyncAt).toBe('2026-11-18T16:00:00.000Z');
  });

  it('caiu no login: sessão expirada', async () => {
    savePortalState('latam', { status: 'saved', learned: REQUEST });
    const p = syncPortal(LATAM_IFLIGHT, deps(), () => {});
    await tick();
    h.emit('urlChangeEvent', { url: 'https://login.microsoftonline.com/common/saml2' });
    h.emit('browserPageLoaded', {});

    await expect(p).resolves.toEqual({ kind: 'login_required' });
    expect(loadPortalState('latam').status).toBe('expired');
    expect(h.close).toHaveBeenCalled();
    expect(h.executeScript).not.toHaveBeenCalled();
  });

  it('caminho aprendido sem PDF: apaga o caminho e pede para conectar', async () => {
    savePortalState('latam', { status: 'saved', learned: REQUEST });
    const p = syncPortal(LATAM_IFLIGHT, deps(), () => {});
    await tick();
    h.emit('urlChangeEvent', { url: 'https://iflightla.ibsplc.aero/iflight-crew/web/home' });
    h.emit('browserPageLoaded', {});
    await tick();
    h.emit('messageFromWebview', { detail: { type: 'replay-failed', status: 200, reason: 'not_pdf' } });

    await expect(p).resolves.toEqual({ kind: 'needs_connect' });
    expect(loadPortalState('latam').learned).toBeNull();
  });

  it('45 s sem resposta: erro e tela fechada', async () => {
    vi.useFakeTimers();
    savePortalState('latam', { status: 'saved', learned: REQUEST });
    const p = syncPortal(LATAM_IFLIGHT, deps(), () => {});
    await vi.advanceTimersByTimeAsync(45_001);

    await expect(p).resolves.toEqual({ kind: 'error', message: 'O iFlight não respondeu' });
    expect(h.close).toHaveBeenCalled();
  });
});

describe('resetPortal', () => {
  it('apaga cookies e o estado local', async () => {
    savePortalState('latam', { status: 'saved', learned: REQUEST });
    await resetPortal(LATAM_IFLIGHT);

    expect(h.clearAllCookies).toHaveBeenCalled();
    expect(loadPortalState('latam').status).toBe('never');
  });
});
