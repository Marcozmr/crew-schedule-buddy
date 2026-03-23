-- Regra de negócio de precedência de escala:
-- portal > manual
-- Apenas uma escala ativa por usuário.

ALTER TABLE public.imported_rosters
  ADD COLUMN IF NOT EXISTS roster_source text,
  ADD COLUMN IF NOT EXISTS roster_status text,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.imported_rosters(id) ON DELETE SET NULL;

-- Backfill de source/status para dados existentes
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

ALTER TABLE public.imported_rosters
  ALTER COLUMN roster_source SET NOT NULL,
  ALTER COLUMN roster_status SET NOT NULL,
  ALTER COLUMN imported_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'imported_rosters_roster_source_chk'
  ) THEN
    ALTER TABLE public.imported_rosters
      ADD CONSTRAINT imported_rosters_roster_source_chk
      CHECK (roster_source IN ('manual', 'portal'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'imported_rosters_roster_status_chk'
  ) THEN
    ALTER TABLE public.imported_rosters
      ADD CONSTRAINT imported_rosters_roster_status_chk
      CHECK (roster_status IN ('active', 'archived', 'superseded', 'failed'));
  END IF;
END $$;

-- Garante uma única escala ativa por usuário
CREATE UNIQUE INDEX IF NOT EXISTS idx_imported_rosters_single_active_user
  ON public.imported_rosters(user_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_imported_rosters_user_source_status
  ON public.imported_rosters(user_id, roster_source, roster_status, created_at DESC);
