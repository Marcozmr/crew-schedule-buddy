-- Heurística de validade da sessão no worker (opcional; UI pode usar para messaging).
ALTER TABLE public.automation_sessions
  ADD COLUMN IF NOT EXISTS session_valid_until timestamptz;

COMMENT ON COLUMN public.automation_sessions.session_valid_until IS
  'Estimativa de expiração da sessão no portal (ex. após persistir storageState). Atualizado pelo worker.';
