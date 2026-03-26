-- Garante colunas de importação PDF usadas pelo cliente (PostgREST schema cache).
-- Idempotente: seguro se 20260327120000_imported_rosters_file_identity.sql e/ou
-- 20260325000000_roster_provider_metadata.sql já tiverem sido aplicadas.

-- Identidade do arquivo (dedupe / consultas por hash)
ALTER TABLE public.imported_rosters
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS content_sha256 text;

COMMENT ON COLUMN public.imported_rosters.file_size_bytes IS 'Tamanho do PDF original em bytes.';
COMMENT ON COLUMN public.imported_rosters.content_sha256 IS 'SHA-256 do conteúdo binário do PDF (dedupe).';

CREATE INDEX IF NOT EXISTS idx_imported_rosters_user_sha
  ON public.imported_rosters (user_id, content_sha256)
  WHERE content_sha256 IS NOT NULL;

-- Metadata de provider / sync (insert/update em pdf-import.ts)
ALTER TABLE public.imported_rosters
  ADD COLUMN IF NOT EXISTS roster_provider text;

ALTER TABLE public.imported_rosters
  ADD COLUMN IF NOT EXISTS source_type text;

ALTER TABLE public.imported_rosters
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz;

ALTER TABLE public.imported_rosters
  ADD COLUMN IF NOT EXISTS sync_status text;

COMMENT ON COLUMN public.imported_rosters.roster_provider IS 'Provider: pdf, manual, corporate_portal, iflight';
COMMENT ON COLUMN public.imported_rosters.source_type IS 'Tipo da fonte: pdf, manual, corporate_portal, official_pdf';
COMMENT ON COLUMN public.imported_rosters.last_sync_at IS 'Última sincronização bem-sucedida';
COMMENT ON COLUMN public.imported_rosters.sync_status IS 'Status: pending, success, error';
