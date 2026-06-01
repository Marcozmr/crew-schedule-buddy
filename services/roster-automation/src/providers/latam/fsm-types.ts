/**
 * Máquina de estados formal — orquestração LATAM → SAB → iFlight → CrewRosterReport.
 * Independente do `status` grosso em automation_sessions (mapeamento em mapFsmToDbStatus).
 */
import type { AutomationStatusRow } from '../../db.js';

export type CorporateFsmState =
  | 'idle'
  | 'starting'
  | 'opening_corporate_portal'
  | 'waiting_sso'
  | 'authenticated'
  | 'opening_portal_sab'
  | 'opening_iflight'
  | 'locating_roster'
  | 'downloading_report'
  | 'importing_report'
  | 'completed'
  | 'needs_user_interaction'
  | 'failed';

/** Mapeia FSM → coluna legacy `status` (CHECK existente nas tabelas). */
export function mapFsmToDbStatus(fsm: CorporateFsmState): AutomationStatusRow {
  switch (fsm) {
    case 'idle':
      return 'disconnected';
    case 'starting':
    case 'opening_corporate_portal':
    case 'waiting_sso':
      return 'portal_connecting';
    case 'authenticated':
    case 'opening_portal_sab':
      return 'portal_connected';
    case 'opening_iflight':
    case 'locating_roster':
      return 'iflight_detected';
    case 'downloading_report':
      return 'roster_downloading';
    case 'importing_report':
      return 'roster_importing';
    case 'completed':
      return 'roster_connected';
    case 'needs_user_interaction':
      return 'reconnect_required';
    case 'failed':
      return 'error';
    default:
      return 'portal_connecting';
  }
}

export interface OrchestrationSnapshot {
  current_url?: string;
  current_host?: string;
  attempt_count?: number;
  last_surface?: string;
  last_title?: string;
  /** Último snapshot técnico pós-login (frames, rede, links) — descoberta de rota. */
  navigation_debug?: Record<string, unknown>;
}

export const FSM_STEP_TIMEOUTS_MS: Partial<Record<CorporateFsmState, number>> = {
  opening_corporate_portal: 120_000,
  waiting_sso: 25 * 60_000,
  authenticated: 60_000,
  opening_portal_sab: 180_000,
  opening_iflight: 180_000,
  locating_roster: 120_000,
  downloading_report: 180_000,
  importing_report: 120_000,
};
