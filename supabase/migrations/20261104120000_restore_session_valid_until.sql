-- A versão 20260327120000 consta como aplicada em produção, mas a coluna nunca foi criada:
-- havia dois arquivos com essa versão e só o de imported_rosters chegou a ser executado.
-- Sem a coluna, o worker falha ao salvar a sessão importada e sempre responde "disconnected".
ALTER TABLE public.automation_sessions
  ADD COLUMN IF NOT EXISTS session_valid_until timestamptz;

COMMENT ON COLUMN public.automation_sessions.session_valid_until IS
  'Estimativa de expiração da sessão no portal (ex. após persistir storageState). Atualizado pelo worker.';
