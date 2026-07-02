/**
 * Cliente WS para o navegador remoto do worker (services/roster-automation).
 * Substitui o WebView Android nativo: o Chromium real do worker faz o login/SSO com o Google
 * (não sofre o bloqueio de OAuth em WebView embutido) e este cliente só exibe a tela (frames
 * JPEG via CDP screencast) e encaminha toques/teclado de volta.
 */

function wsBaseUrl(): string | undefined {
  const httpBase = import.meta.env.VITE_ROSTER_AUTOMATION_URL?.trim();
  if (!httpBase) return undefined;
  return httpBase.replace(/^http/, 'ws');
}

/**
 * Navegadores móveis (Android/iOS, nativo ou apenas o site aberto no Chrome/Safari do celular)
 * não suportam extensões de browser — por isso não podem usar o fluxo de captura de cookies
 * via extensão (só funciona em Chrome desktop). Nesses casos o navegador remoto é o único
 * caminho automático disponível.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export type RemoteSessionStatus = string;

export interface RemoteSessionHandlers {
  onFrame: (base64Jpeg: string) => void;
  onStatus: (status: RemoteSessionStatus) => void;
  onClose: (reason: string) => void;
  onError?: (message: string) => void;
}

export interface RemoteSessionClient {
  sendTap: (xFraction: number, yFraction: number) => void;
  sendText: (value: string) => void;
  sendKey: (key: string) => void;
  sendScroll: (dy: number) => void;
  close: () => void;
}

/** Abre a ligação WS para um run específico. Lança erro se a automação não estiver configurada. */
export async function connectRemoteSession(
  runId: string,
  getAccessToken: () => Promise<string | null>,
  handlers: RemoteSessionHandlers,
): Promise<RemoteSessionClient> {
  const base = wsBaseUrl();
  if (!base) throw new Error('Automação não configurada — VITE_ROSTER_AUTOMATION_URL não definido');

  const token = await getAccessToken();
  if (!token) throw new Error('Sessão expirada — inicie sessão novamente.');

  const url = `${base}/v1/latam/remote/${encodeURIComponent(runId)}?token=${encodeURIComponent(token)}`;
  const socket = new WebSocket(url);

  socket.onmessage = (event: MessageEvent<string>) => {
    try {
      const msg = JSON.parse(event.data) as { type: string; data?: string; fsm?: string };
      if (msg.type === 'frame' && msg.data) handlers.onFrame(msg.data);
      else if (msg.type === 'status' && msg.fsm) handlers.onStatus(msg.fsm);
    } catch {
      /* mensagem malformada — ignora */
    }
  };
  socket.onclose = (event: CloseEvent) => handlers.onClose(event.reason || 'closed');
  socket.onerror = () => handlers.onError?.('Erro na ligação com o navegador remoto');

  const send = (payload: Record<string, unknown>) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
  };

  return {
    sendTap: (x, y) => send({ type: 'tap', x, y }),
    sendText: (value) => send({ type: 'text', value }),
    sendKey: (key) => send({ type: 'key', key }),
    sendScroll: (dy) => send({ type: 'scroll', dy }),
    close: () => socket.close(),
  };
}
