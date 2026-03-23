-- Garante colunas de precedência (portal > manual) quando a migration
-- 20260321190000 não foi aplicada no projeto remoto ou falhou parcialmente.
-- Idempotente: seguro rodar várias vezes.

ALTER TABLE public.imported_rosters
  ADD COLUMN IF NOT EXISTS roster_source text,
  ADD COLUMN IF NOT EXISTS roster_status text,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.imported_rosters(id) ON DELETE SET NULL;

-- Backfill apenas onde ainda nulo
UPDATE public.imported_rosters
SET roster_source = CASE
  WHEN portal_connection_id IS NOT NULL OR connector_key IS NOT NULL OR import_origin IN ('portal', 'authenticated_html', 'authenticated_endpoint') THEN 'portal'
  ELSE 'manual'
END
WHERE roster_source IS NULL;

UPDATE public.imported_rosters
SET roster_status = CASE
  WHEN is_active THEN 'active'
  WHEN import_status = 'error' THEN 'failed'
  ELSE 'archived'
END
WHERE roster_status IS NULL;

UPDATE public.imported_rosters
SET imported_at = COALESCE(imported_at, created_at)
WHERE imported_at IS NULL;

ALTER TABLE public.imported_rosters
  ALTER COLUMN roster_source SET DEFAULT 'manual',
  ALTER COLUMN roster_status SET DEFAULT 'archived',
  ALTER COLUMN imported_at SET DEFAULT now();

-- NOT NULL só se não houver NULLs restantes (evita falha em bases legadas vazias)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.imported_rosters WHERE roster_source IS NULL) THEN
    ALTER TABLE public.imported_rosters ALTER COLUMN roster_source SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.imported_rosters WHERE roster_status IS NULL) THEN
    ALTER TABLE public.imported_rosters ALTER COLUMN roster_status SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.imported_rosters WHERE imported_at IS NULL) THEN
    ALTER TABLE public.imported_rosters ALTER COLUMN imported_at SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'imported_rosters_roster_source_chk'
  ) THEN
    ALTER TABLE public.imported_rosters
      ADD CONSTRAINT imported_rosters_roster_source_chk
      CHECK (roster_source IN ('manual', 'portal'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'imported_rosters_roster_status_chk'
  ) THEN
    ALTER TABLE public.imported_rosters
      ADD CONSTRAINT imported_rosters_roster_status_chk
      CHECK (roster_status IN ('active', 'archived', 'superseded', 'failed'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_imported_rosters_single_active_user
  ON public.imported_rosters(user_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_imported_rosters_user_source_status
  ON public.imported_rosters(user_id, roster_source, roster_status, created_at DESC);
