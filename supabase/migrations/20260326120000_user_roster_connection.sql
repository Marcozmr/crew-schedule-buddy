-- Conexão de escala por usuário (projeção de produto) + colunas de versionamento em imported_rosters

CREATE TABLE IF NOT EXISTS public.user_roster_connection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  connection_type text NOT NULL CHECK (connection_type IN (
    'corporate_pdf',
    'official_pdf',
    'manual_fallback',
    'future_enterprise_sync'
  )),
  connection_status text NOT NULL DEFAULT 'disconnected' CHECK (connection_status IN (
    'disconnected',
    'connecting',
    'connected',
    'error'
  )),
  connected_at timestamptz,
  last_checked_at timestamptz,
  last_successful_import_at timestamptz,
  current_active_roster_id uuid REFERENCES public.imported_rosters (id) ON DELETE SET NULL,
  last_error text,
  is_auto_update_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_roster_connection_user_id_key UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roster_connection_user ON public.user_roster_connection (user_id);

ALTER TABLE public.imported_rosters
  ADD COLUMN IF NOT EXISTS is_official_crew_roster_pdf boolean NOT NULL DEFAULT false;

ALTER TABLE public.imported_rosters
  ADD COLUMN IF NOT EXISTS superseded_by_roster_id uuid REFERENCES public.imported_rosters (id) ON DELETE SET NULL;

COMMENT ON TABLE public.user_roster_connection IS 'Estado de produto: escala conectada ao EscalaX (sem credenciais de portal).';
COMMENT ON COLUMN public.imported_rosters.superseded_by_roster_id IS 'Nova escala ativa que substitui esta versão (histórico preservado).';

ALTER TABLE public.user_roster_connection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roster_connection_select_own"
  ON public.user_roster_connection FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_roster_connection_insert_own"
  ON public.user_roster_connection FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_roster_connection_update_own"
  ON public.user_roster_connection FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_roster_connection_updated_at
  BEFORE UPDATE ON public.user_roster_connection
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
