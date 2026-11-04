-- Identidade do arquivo (dedupe / auditoria) — PDF oficial persistido no Storage
ALTER TABLE public.imported_rosters
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS content_sha256 text;

COMMENT ON COLUMN public.imported_rosters.file_size_bytes IS 'Tamanho do PDF original em bytes.';
COMMENT ON COLUMN public.imported_rosters.content_sha256 IS 'SHA-256 do conteúdo binário do PDF (dedupe).';

CREATE INDEX IF NOT EXISTS idx_imported_rosters_user_sha
  ON public.imported_rosters (user_id, content_sha256)
  WHERE content_sha256 IS NOT NULL;
