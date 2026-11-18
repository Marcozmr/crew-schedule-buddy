/**
 * Conecta e sincroniza o portal de escala pela WebView do próprio app (@capgo/inappbrowser).
 *
 * connectPortal: tela visível; a tripulante faz o login; o script da página captura o PDF.
 * syncPortal: tela escondida; com a sessão salva, refaz a requisição aprendida.
 * Ver docs/superpowers/specs/2026-11-18-conexao-portal-no-aparelho-design.md.
 */
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { InAppBrowser, ToolBarType } from '@capgo/inappbrowser';
import type { PdfImportResult } from '@/lib/pdf-import';
import { buildPageScript, buildReplayScript, type PageMessage } from './page-script';
import { hostKind, type DevicePortalProvider, type LearnedEndpoint } from './providers';
import { loadPortalState, resetPortalState, savePortalState } from './session-store';

export type PortalStep = 'conectando' | 'lendo' | 'salvando' | 'pronto';

export type PortalResult =
  | { kind: 'imported'; parsedCount: number; insertedCount: number; duplicate: boolean }
  | { kind: 'login_required' }
  | { kind: 'needs_connect' }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

export interface PortalDeps {
  importPdf(fileName: string, bytes: ArrayBuffer): Promise<PdfImportResult>;
  now?(): Date;
  /** Espera após a página do portal carregar antes de refazer a requisição (redirecionamentos por JS). */
  settleMs?: number;
}

export const STEP_LABELS: Record<PortalStep, string> = {
  conectando: 'Conectando ao portal',
  lendo: 'Lendo sua escala',
  salvando: 'Salvando no aparelho',
  pronto: 'Pronto',
};

const SYNC_TIMEOUT_MS = 45_000;

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function isPdf(buf: ArrayBuffer): boolean {
  const u = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
  return u.length === 4 && u[0] === 0x25 && u[1] === 0x50 && u[2] === 0x44 && u[3] === 0x46;
}

function fileNameFor(provider: DevicePortalProvider, now: Date): string {
  return `${provider.id}-iflight-${now.toISOString().slice(0, 10)}.pdf`;
}

function readMessage(e: unknown): PageMessage | null {
  const d = (e as { detail?: unknown } | null)?.detail;
  if (!d || typeof d !== 'object' || typeof (d as { type?: unknown }).type !== 'string') return null;
  return d as PageMessage;
}

/** Listeners do plugin com limpeza garantida. */
async function listen(handlers: Record<string, (e: unknown) => void>): Promise<() => void> {
  const handles: PluginListenerHandle[] = await Promise.all(
    Object.entries(handlers).map(([name, fn]) =>
      (InAppBrowser.addListener as (n: string, f: (e: unknown) => void) => Promise<PluginListenerHandle>)(name, fn),
    ),
  );
  return () => {
    for (const handle of handles) void handle.remove();
  };
}

async function closeQuietly(): Promise<void> {
  try {
    await InAppBrowser.close();
  } catch {
    /* já fechada */
  }
}

/**
 * Importa o PDF capturado e atualiza o estado. `learned` só é trocado quando há requisição de origem.
 */
async function importCaptured(
  provider: DevicePortalProvider,
  deps: PortalDeps,
  bytes: ArrayBuffer,
  request: LearnedEndpoint | null,
): Promise<PortalResult> {
  const now = deps.now?.() ?? new Date();
  let result: PdfImportResult;
  try {
    result = await deps.importPdf(fileNameFor(provider, now), bytes);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    savePortalState(provider.id, { lastError: message });
    return { kind: 'error', message };
  }
  if (!result.success) {
    const message = result.error ?? 'Não foi possível ler o PDF da escala.';
    savePortalState(provider.id, { lastError: message });
    return { kind: 'error', message };
  }
  const prev = loadPortalState(provider.id);
  savePortalState(provider.id, {
    status: 'saved',
    lastSyncAt: now.toISOString(),
    learned: request ?? prev.learned,
    lastError: null,
  });
  return {
    kind: 'imported',
    parsedCount: result.parsedCount,
    insertedCount: result.insertedCount,
    duplicate: Boolean(result.duplicate),
  };
}

export async function connectPortal(
  provider: DevicePortalProvider,
  deps: PortalDeps,
  onStep: (s: PortalStep) => void,
): Promise<PortalResult> {
  const script = buildPageScript(provider, { autoNav: true });
  let step: PortalStep = 'conectando';
  let settled = false;
  let capturing = false;
  let lastHint: string | null = null;
  let finish: (r: PortalResult) => void = () => {};
  const done = new Promise<PortalResult>((resolve) => {
    finish = resolve;
  });

  const setStep = (s: PortalStep) => {
    step = s;
    onStep(s);
    InAppBrowser.postMessage({ detail: { label: STEP_LABELS[s] } }).catch(() => undefined);
  };

  const settle = async (r: PortalResult, close: boolean) => {
    if (settled) return;
    settled = true;
    if (close) await closeQuietly();
    finish(r);
  };

  const handleBytes = async (bytes: ArrayBuffer, request: LearnedEndpoint | null) => {
    if (capturing || settled) return;
    capturing = true;
    setStep('salvando');
    const r = await importCaptured(provider, deps, bytes, request);
    if (r.kind === 'imported') setStep('pronto');
    await settle(r, true);
  };

  const stop = await listen({
    urlChangeEvent: (e) => {
      const url = (e as { url?: string })?.url ?? '';
      if (step === 'conectando' && hostKind(provider, url) === 'portal') setStep('lendo');
    },
    browserPageLoaded: () => {
      InAppBrowser.executeScript({ code: script }).catch(() => undefined);
      InAppBrowser.postMessage({ detail: { label: STEP_LABELS[step] } }).catch(() => undefined);
    },
    messageFromWebview: (e) => {
      const msg = readMessage(e);
      if (!msg) return;
      if (msg.type === 'pdf') void handleBytes(base64ToArrayBuffer(msg.base64), msg.request);
      else if (msg.type === 'page' && msg.errorHint) lastHint = msg.errorHint;
    },
    downloadCompleted: (e) => {
      const path = (e as { path?: string })?.path;
      if (!path) return;
      void (async () => {
        try {
          const buf = await (await fetch(Capacitor.convertFileSrc(path))).arrayBuffer();
          if (isPdf(buf)) await handleBytes(buf, null);
        } catch {
          /* download que não é PDF: ignora */
        }
      })();
    },
    closeEvent: () => {
      if (capturing) return;
      if (lastHint) {
        savePortalState(provider.id, { lastError: lastHint });
        void settle({ kind: 'error', message: `O portal recusou o login: ${lastHint}` }, false);
      } else {
        void settle({ kind: 'cancelled' }, false);
      }
    },
  });

  onStep('conectando');
  try {
    await InAppBrowser.openWebView({
      url: provider.startUrl,
      title: provider.title,
      toolbarType: ToolBarType.COMPACT,
      isPresentAfterPageLoad: true,
      preShowScript: script,
      preShowScriptInjectionTime: 'documentStart',
      openBlankTargetInWebView: true,
      handleDownloads: true,
    });
  } catch (err) {
    await settle({ kind: 'error', message: err instanceof Error ? err.message : String(err) }, false);
  }

  const result = await done;
  stop();
  return result;
}

export async function syncPortal(
  provider: DevicePortalProvider,
  deps: PortalDeps,
  onStep: (s: PortalStep) => void,
): Promise<PortalResult> {
  const learned = loadPortalState(provider.id).learned;
  if (!learned) return { kind: 'needs_connect' };

  const settleMs = deps.settleMs ?? 1500;
  let lastUrl = provider.startUrl;
  let replayed = false;
  let settled = false;
  let capturing = false;
  let finish: (r: PortalResult) => void = () => {};
  const done = new Promise<PortalResult>((resolve) => {
    finish = resolve;
  });

  const settle = async (r: PortalResult) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    await closeQuietly();
    finish(r);
  };

  const expired = () => {
    savePortalState(provider.id, { status: 'expired' });
    void settle({ kind: 'login_required' });
  };

  const timer = setTimeout(() => void settle({ kind: 'error', message: 'O iFlight não respondeu' }), SYNC_TIMEOUT_MS);

  const stop = await listen({
    urlChangeEvent: (e) => {
      lastUrl = (e as { url?: string })?.url ?? lastUrl;
    },
    browserPageLoaded: () => {
      if (replayed || settled) return;
      const kind = hostKind(provider, lastUrl);
      if (kind === 'login') {
        expired();
        return;
      }
      if (kind !== 'portal') return;
      setTimeout(() => {
        if (replayed || settled) return;
        if (hostKind(provider, lastUrl) === 'login') {
          expired();
          return;
        }
        replayed = true;
        onStep('lendo');
        InAppBrowser.executeScript({ code: buildReplayScript(learned) }).catch(() => undefined);
      }, settleMs);
    },
    messageFromWebview: (e) => {
      const msg = readMessage(e);
      if (!msg || settled) return;
      if (msg.type === 'pdf' && !capturing) {
        capturing = true;
        onStep('salvando');
        void importCaptured(provider, deps, base64ToArrayBuffer(msg.base64), msg.request ?? learned).then((r) => {
          if (r.kind === 'imported') onStep('pronto');
          return settle(r);
        });
      } else if (msg.type === 'replay-failed') {
        savePortalState(provider.id, { learned: null });
        void settle({ kind: 'needs_connect' });
      }
    },
  });

  onStep('conectando');
  try {
    await InAppBrowser.openWebView({ url: provider.startUrl, title: provider.title, hidden: true });
  } catch (err) {
    await settle({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
  }

  const result = await done;
  stop();
  return result;
}

export async function resetPortal(provider: DevicePortalProvider): Promise<void> {
  await closeQuietly();
  try {
    await InAppBrowser.clearAllCookies();
  } catch {
    /* sem cookies para apagar */
  }
  resetPortalState(provider.id);
}
