/**
 * Rota WS que expõe o navegador remoto (screencast + input) ao app.
 * Autenticação via JWT na query string (handshake WS não permite Authorization custom no browser).
 * Nunca logar a URL completa da ligação — contém o token.
 */
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { getUserIdFromJwt } from '../auth.js';
import { getServiceClient } from '../db.js';
import { config } from '../config.js';
import { log } from '../logger.js';
import { registerSocket, unregisterSocket, dispatchInput, type RemoteInputMessage } from './registry.js';

const SCOPE = 'remote-ws';

function isValidInputMessage(v: unknown): v is RemoteInputMessage {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  switch (m.type) {
    case 'tap':
      return typeof m.x === 'number' && typeof m.y === 'number';
    case 'text':
      return typeof m.value === 'string';
    case 'key':
      return typeof m.key === 'string';
    case 'scroll':
      return typeof m.dy === 'number';
    default:
      return false;
  }
}

export function registerRemoteSessionRoute(app: FastifyInstance): void {
  app.get('/v1/latam/remote/:runId', { websocket: true }, async (socket: WebSocket, req) => {
    const { runId } = req.params as { runId: string };
    const { token } = req.query as { token?: string };

    const origin = req.headers.origin;
    const allowedOrigins = config.corsOrigins();
    if (origin && !allowedOrigins.includes(origin)) {
      log(SCOPE, 'warn', 'remote_ws_origin_rejected', { runId });
      socket.close(1008, 'origin_not_allowed');
      return;
    }

    const userId = await getUserIdFromJwt(token ? `Bearer ${token}` : undefined);
    if (!userId) {
      log(SCOPE, 'warn', 'remote_ws_auth_failed', { runId });
      socket.close(1008, 'unauthorized');
      return;
    }

    const supabase = getServiceClient();
    const { data: run, error } = await supabase
      .from('automation_runs')
      .select('id, user_id')
      .eq('id', runId)
      .maybeSingle();

    if (error || !run || (run as { user_id: string }).user_id !== userId) {
      log(SCOPE, 'warn', 'remote_ws_run_forbidden', { runId, userId });
      socket.close(1008, 'forbidden');
      return;
    }

    const remoteSocket = {
      send: (data: string) => socket.send(data),
      close: (code?: number, reason?: string) => socket.close(code, reason),
    };

    registerSocket(runId, remoteSocket);
    log(SCOPE, 'info', 'remote_ws_connected', { runId, userId });

    socket.on('message', (raw: Buffer) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (isValidInputMessage(parsed)) {
        void dispatchInput(runId, parsed);
      }
    });

    socket.on('close', () => {
      unregisterSocket(runId, remoteSocket);
      log(SCOPE, 'info', 'remote_ws_closed', { runId });
    });
  });
}
