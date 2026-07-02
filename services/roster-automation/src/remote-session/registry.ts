/**
 * Ponte entre o Chromium do Playwright (login real, sem bloqueio do Google) e o app móvel:
 * transmite a tela via CDP screencast e recebe toques/teclado para controlar a página remota.
 * Necessário porque, ao contrário do browser extension (desktop), o Android não tem forma de
 * ler cookies de um Chrome Custom Tab — o navegador remoto real é a única forma de manter o
 * login dentro da política do Google e ainda assim automatizar o resto do fluxo.
 */
import type { CDPSession, Page } from 'playwright';
import { log } from '../logger.js';

const SCOPE = 'remote-session';

export type RemoteSocket = {
  send(data: string): void;
  close(code?: number, reason?: string): void;
};

export type RemoteInputMessage =
  | { type: 'tap'; x: number; y: number }
  | { type: 'text'; value: string }
  | { type: 'key'; key: string }
  | { type: 'scroll'; dy: number };

interface RemoteRunEntry {
  sockets: Set<RemoteSocket>;
  page?: Page;
  cdp?: CDPSession;
  viewport: { width: number; height: number };
  lastStatus: string;
}

const runs = new Map<string, RemoteRunEntry>();

function getOrCreateEntry(runId: string): RemoteRunEntry {
  let entry = runs.get(runId);
  if (!entry) {
    entry = { sockets: new Set(), viewport: { width: 1400, height: 900 }, lastStatus: 'starting' };
    runs.set(runId, entry);
  }
  return entry;
}

function broadcast(entry: RemoteRunEntry, payload: Record<string, unknown>): void {
  const data = JSON.stringify(payload);
  for (const socket of entry.sockets) {
    try {
      socket.send(data);
    } catch {
      /* socket já fechado — será removido no evento close */
    }
  }
}

/** Regista o socket de um cliente para um run. Envia o estado atual imediatamente. */
export function registerSocket(runId: string, socket: RemoteSocket): void {
  const entry = getOrCreateEntry(runId);
  entry.sockets.add(socket);
  socket.send(JSON.stringify({ type: 'status', fsm: entry.lastStatus }));
}

export function unregisterSocket(runId: string, socket: RemoteSocket): void {
  const entry = runs.get(runId);
  entry?.sockets.delete(socket);
}

/**
 * Liga o screencast CDP à página ativa do run. Idempotente — chamadas subsequentes com a
 * mesma página não recriam a sessão CDP.
 */
export async function attachRemoteSession(runId: string, page: Page): Promise<void> {
  const entry = getOrCreateEntry(runId);
  if (entry.page === page && entry.cdp) return;

  const viewport = page.viewportSize();
  if (viewport) entry.viewport = viewport;

  entry.page = page;
  entry.lastStatus = 'waiting_sso';
  broadcast(entry, { type: 'status', fsm: 'waiting_sso' });

  try {
    const cdp = await page.context().newCDPSession(page);
    entry.cdp = cdp;
    cdp.on('Page.screencastFrame', (frame: { data: string; sessionId: number }) => {
      broadcast(entry, { type: 'frame', data: frame.data });
      cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 55,
      maxWidth: 480,
      maxHeight: 900,
      everyNthFrame: 1,
    });
    log(SCOPE, 'info', 'remote_session_attached', { runId });
  } catch (e) {
    log(SCOPE, 'error', 'remote_session_attach_failed', { runId, message: e instanceof Error ? e.message : String(e) });
  }
}

/** Para o screencast e avisa os clientes ligados. Idempotente. */
export async function detachRemoteSession(runId: string, reason: string): Promise<void> {
  const entry = runs.get(runId);
  if (!entry) return;

  if (entry.cdp) {
    await entry.cdp.send('Page.stopScreencast').catch(() => {});
    await entry.cdp.detach().catch(() => {});
  }
  entry.lastStatus = reason;
  broadcast(entry, { type: 'status', fsm: reason });
  for (const socket of entry.sockets) {
    socket.close(1000, reason);
  }
  runs.delete(runId);
  log(SCOPE, 'info', 'remote_session_detached', { runId, reason });
}

const ALLOWED_KEYS = new Set(['Backspace', 'Enter', 'Tab', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

/** Traduz um evento de input do cliente em ações reais no Chromium remoto (eventos confiáveis via CDP). */
export async function dispatchInput(runId: string, msg: RemoteInputMessage): Promise<void> {
  const entry = runs.get(runId);
  if (!entry?.page) return;
  const { width, height } = entry.viewport;

  try {
    switch (msg.type) {
      case 'tap': {
        const x = Math.max(0, Math.min(1, msg.x)) * width;
        const y = Math.max(0, Math.min(1, msg.y)) * height;
        await entry.page.mouse.click(x, y);
        break;
      }
      case 'text': {
        if (typeof msg.value === 'string' && msg.value.length > 0 && msg.value.length < 500) {
          await entry.page.keyboard.insertText(msg.value);
        }
        break;
      }
      case 'key': {
        if (ALLOWED_KEYS.has(msg.key)) {
          await entry.page.keyboard.press(msg.key);
        }
        break;
      }
      case 'scroll': {
        const dy = Math.max(-2000, Math.min(2000, msg.dy));
        await entry.page.mouse.wheel(0, dy);
        break;
      }
    }
  } catch (e) {
    log(SCOPE, 'warn', 'remote_session_input_failed', { runId, type: msg.type, message: e instanceof Error ? e.message : String(e) });
  }
}

export function hasActiveSession(runId: string): boolean {
  return runs.has(runId);
}
