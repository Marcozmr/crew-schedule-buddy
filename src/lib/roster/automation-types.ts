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

/** Estados FSM da orquestração corporativa (worker Playwright). Opcional até migração aplicada. */
export type CorporateFsmStateUi =
  | 'idle'
  | 'starting'
  | 'opening_corporate_portal'
  | 'waiting_sso'
  | 'authenticated'
  | 'opening_portal_sab'
  | 'opening_iflight'
  | 'iflight_loaded'          // iFlight Neo carregado — localizando escala
  | 'locating_roster'
  | 'downloading_report'
  | 'importing_report'
  | 'completed'
  | 'needs_user_interaction'
  | 'failed';

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
  /** Migração `corporate_automation_fsm` — estado fino para copy e diagnóstico. */
  fsm_state?: CorporateFsmStateUi | string | null;
  last_success_fsm_state?: string | null;
  orchestration_snapshot?: {
    current_url?: string;
    current_host?: string;
    attempt_count?: number;
    last_surface?: string;
    last_title?: string;
  } | null;
  /** Migração `automation_runs_requested_month` — mês (YYYY-MM) escolhido pelo utilizador, nulo em kicks automáticos. */
  requested_month?: string | null;
}
