-- Sessões e execuções de automação (Playwright) por utilizador — fora de Edge Functions.
-- O worker Node atualiza estas linhas com service role; o cliente lê o estado (polling ou Realtime).

CREATE TABLE IF NOT EXISTS public.automation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'latam' CHECK (provider IN ('latam')),
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN (
    'disconnected',
    'portal_connecting',
    'portal_connected',
    'iflight_detected',
    'roster_downloading',
    'roster_importing',
    'roster_connected',
    'reconnect_required',
    'error'
  )),
  /** Caminho relativo no disco do worker (ex.: data/latam/{userId}/storage.json) — não contém segredos em texto claro na BD. */
  storage_state_path text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT automation_sessions_user_provider_key UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_automation_sessions_user ON public.automation_sessions (user_id);

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.automation_sessions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'portal_connecting' CHECK (status IN (
    'disconnected',
    'portal_connecting',
    'portal_connected',
    'iflight_detected',
    'roster_downloading',
    'roster_importing',
    'roster_connected',
    'reconnect_required',
    'error'
  )),
  step_logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  /** Prefixo local de artefactos (screenshot/HTML) em falhas — worker. */
  artifact_base_path text,
  imported_roster_id uuid REFERENCES public.imported_rosters (id) ON DELETE SET NULL,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_session ON public.automation_runs (session_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_user_started ON public.automation_runs (user_id, started_at DESC);

ALTER TABLE public.imported_rosters
  ADD COLUMN IF NOT EXISTS automation_run_id uuid REFERENCES public.automation_runs (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_imported_rosters_automation_run ON public.imported_rosters (automation_run_id);

ALTER TABLE public.user_roster_connection
  ADD COLUMN IF NOT EXISTS automation_session_id uuid REFERENCES public.automation_sessions (id) ON DELETE SET NULL;

COMMENT ON TABLE public.automation_sessions IS 'Estado da automação Playwright por utilizador e fornecedor (ex. portal LATAM).';
COMMENT ON TABLE public.automation_runs IS 'Execução pontual (conexão, download, importação) com logs estruturados.';
COMMENT ON COLUMN public.imported_rosters.automation_run_id IS 'Associação opcional à execução de automação que produziu este PDF.';

ALTER TABLE public.automation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_sessions_select_own" ON public.automation_sessions;
CREATE POLICY "automation_sessions_select_own"
  ON public.automation_sessions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "automation_runs_select_own" ON public.automation_runs;
CREATE POLICY "automation_runs_select_own"
  ON public.automation_runs FOR SELECT
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_automation_sessions_updated_at ON public.automation_sessions;
CREATE TRIGGER update_automation_sessions_updated_at
  BEFORE UPDATE ON public.automation_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_automation_runs_updated_at ON public.automation_runs;
CREATE TRIGGER update_automation_runs_updated_at
  BEFORE UPDATE ON public.automation_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_sessions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_runs;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
