CREATE TABLE public.portal_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  connector_key TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'Portal',
  connection_status TEXT NOT NULL DEFAULT 'disconnected',
  sync_enabled BOOLEAN NOT NULL DEFAULT false,
  source_kind TEXT NOT NULL DEFAULT 'official_pdf',
  connected_at TIMESTAMP WITH TIME ZONE NULL,
  disconnected_at TIMESTAMP WITH TIME ZONE NULL,
  last_synced_at TIMESTAMP WITH TIME ZONE NULL,
  last_successful_sync_at TIMESTAMP WITH TIME ZONE NULL,
  session_expires_at TIMESTAMP WITH TIME ZONE NULL,
  last_error TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT portal_connections_user_connector_key UNIQUE (user_id, connector_key)
);

ALTER TABLE public.portal_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own portal connections"
ON public.portal_connections
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own portal connections"
ON public.portal_connections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own portal connections"
ON public.portal_connections
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own portal connections"
ON public.portal_connections
FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_portal_connections_user_id ON public.portal_connections(user_id);
CREATE INDEX idx_portal_connections_status ON public.portal_connections(connection_status);

CREATE TRIGGER update_portal_connections_updated_at
BEFORE UPDATE ON public.portal_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.portal_sync_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  connection_id UUID NOT NULL REFERENCES public.portal_connections(id) ON DELETE CASCADE,
  connector_key TEXT NOT NULL,
  run_status TEXT NOT NULL DEFAULT 'pending',
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  source_kind TEXT NOT NULL DEFAULT 'official_pdf',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE NULL,
  roster_id UUID NULL REFERENCES public.imported_rosters(id) ON DELETE SET NULL,
  imported_count INTEGER NOT NULL DEFAULT 0,
  parsed_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.portal_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own portal sync runs"
ON public.portal_sync_runs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own portal sync runs"
ON public.portal_sync_runs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own portal sync runs"
ON public.portal_sync_runs
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own portal sync runs"
ON public.portal_sync_runs
FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_portal_sync_runs_user_id ON public.portal_sync_runs(user_id);
CREATE INDEX idx_portal_sync_runs_connection_started_at ON public.portal_sync_runs(connection_id, started_at DESC);

ALTER TABLE public.imported_rosters
ADD COLUMN IF NOT EXISTS import_origin TEXT NOT NULL DEFAULT 'manual_upload',
ADD COLUMN IF NOT EXISTS connector_key TEXT NULL,
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP WITH TIME ZONE NULL,
ADD COLUMN IF NOT EXISTS portal_connection_id UUID NULL REFERENCES public.portal_connections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_imported_rosters_portal_connection_id ON public.imported_rosters(portal_connection_id);