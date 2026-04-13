/**
 * Tipos das tabelas `automation_sessions` / `automation_runs` (alinhados à migration SQL).
 */

export type AutomationSessionStatus =
  | 'disconnected'
  | 'portal_connecting'
  | 'portal_connected'
  | 'iflight_detected'
  | 'roster_downloading'
  | 'roster_importing'
  | 'roster_connected'
  | 'reconnect_required'
  | 'error';

export interface AutomationSessionRow {
  id: string;
  user_id: string;
  provider: string;
  status: AutomationSessionStatus;
  storage_state_path: string | null;
  /** Estimativa de expiração (worker); opcional até migração aplicada. */
  session_valid_until?: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationRunRow {
  id: string;
  session_id: string;
  user_id: string;
  status: AutomationSessionStatus;
  step_logs: unknown[];
  artifact_base_path: string | null;
  imported_roster_id: string | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}
