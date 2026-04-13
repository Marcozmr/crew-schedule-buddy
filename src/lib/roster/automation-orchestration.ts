/**
 * Orquestração LATAM (cliente): quando chamar connect vs sync.
 * A UI não precisa de botões — estes helpers alimentam hooks invisíveis e o bootstrap do card.
 */

import type { AutomationRunRow, AutomationSessionRow, AutomationSessionStatus } from './automation-types';

/** Estados em que o worker ainda está a alterar portal/sessão — não dispara novo pedido. */
export const AUTOMATION_ACTIVE_SESSION_STATUSES: AutomationSessionStatus[] = [
  'portal_connecting',
  'iflight_detected',
  'roster_downloading',
  'roster_importing',
];

export function isAutomationRunInFlight(run: AutomationRunRow | null | undefined): boolean {
  if (!run) return false;
  return !run.finished_at;
}

export function isSessionBusy(status: AutomationSessionStatus | undefined): boolean {
  if (!status) return false;
  return AUTOMATION_ACTIVE_SESSION_STATUSES.includes(status);
}

export interface LatamAppLoadKickContext {
  /** ms epoch da última sync disparada pelo gatilho “abrir app” (ex.: sessionStorage). */
  lastAppLoadSyncAt: number | null;
  /** Se já foi chamado POST /connect sem linha de sessão neste browser (evita loop). */
  initialConnectAttempted: boolean;
  /** Intervalo mínimo entre syncs automáticas quando já existe escala ativa (refresh). */
  minIntervalMs: number;
}

const DEFAULT_APP_LOAD_MIN_MS = 25 * 60 * 1000;

/**
 * Disparo ao abrir a app (sessão Supabase válida): sync periódica, retomada de pipeline,
 * ou primeira ligação (connect) se ainda não existir `automation_sessions`.
 */
export function decideLatamAppLoadKick(
  session: AutomationSessionRow | null,
  latestRun: AutomationRunRow | null,
  ctx: Partial<LatamAppLoadKickContext> = {},
): { action: 'connect' | 'sync' } | null {
  const {
    lastAppLoadSyncAt = null,
    initialConnectAttempted = false,
    minIntervalMs = DEFAULT_APP_LOAD_MIN_MS,
  } = ctx;

  if (isAutomationRunInFlight(latestRun)) return null;

  const st = session?.status;
  if (st && AUTOMATION_ACTIVE_SESSION_STATUSES.includes(st)) return null;
  if (st === 'reconnect_required' || st === 'error') return null;

  if (!session) {
    if (initialConnectAttempted) return null;
    return { action: 'connect' };
  }

  if (st === 'roster_connected') {
    const t = lastAppLoadSyncAt;
    if (t != null && Date.now() - t < minIntervalMs) return null;
    return { action: 'sync' };
  }

  if (st === 'portal_connected') {
    return { action: 'sync' };
  }

  if (st === 'disconnected') {
    return { action: 'connect' };
  }

  return null;
}

/**
 * Bootstrap quando o card de estado está montado: retomar erros, nunca competir com o primeiro connect
 * (esse fica a cargo de `decideLatamAppLoadKick` ao abrir a app).
 */
export function decideLatamAutomationKick(
  session: AutomationSessionRow | null,
  latestRun: AutomationRunRow | null,
): { action: 'connect' | 'sync' } | null {
  if (isAutomationRunInFlight(latestRun)) return null;
  const st = session?.status;
  if (st && AUTOMATION_ACTIVE_SESSION_STATUSES.includes(st)) return null;
  if (st === 'roster_connected') return null;

  if (!session) return null;

  if (st === 'error' || st === 'reconnect_required' || st === 'disconnected') {
    return { action: 'connect' };
  }

  if (st === 'portal_connected') {
    if (latestRun?.finished_at && latestRun.error_message) return { action: 'sync' };
    return null;
  }

  return null;
}
