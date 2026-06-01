-- Estado formal da orquestração LATAM (FSM) e snapshot para retomada/diagnóstico.
-- Executa após automation_sessions_and_runs (20260430120000).

ALTER TABLE public.automation_runs
  ADD COLUMN IF NOT EXISTS fsm_state text,
  ADD COLUMN IF NOT EXISTS last_success_fsm_state text,
  ADD COLUMN IF NOT EXISTS orchestration_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.automation_runs.fsm_state IS 'Estado da máquina de estados da automação corporativa (ex.: waiting_sso, opening_portal_sab).';
COMMENT ON COLUMN public.automation_runs.last_success_fsm_state IS 'Último estado FSM concluído com sucesso nesta execução.';
COMMENT ON COLUMN public.automation_runs.orchestration_snapshot IS 'URL, host, tentativas e superfície detetada (diagnóstico / retomada).';
