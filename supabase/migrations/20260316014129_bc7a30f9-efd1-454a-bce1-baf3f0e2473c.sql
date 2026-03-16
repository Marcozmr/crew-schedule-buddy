ALTER TABLE public.imported_rosters
  ALTER COLUMN is_active SET DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_imported_rosters_user_active
  ON public.imported_rosters (user_id, is_active, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS imported_rosters_one_active_per_user
  ON public.imported_rosters (user_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_schedule_entries_user_roster
  ON public.schedule_entries (user_id, roster_id);

ALTER TABLE public.schedule_entries
  ALTER COLUMN roster_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'schedule_entries_roster_id_fkey'
  ) THEN
    ALTER TABLE public.schedule_entries
      ADD CONSTRAINT schedule_entries_roster_id_fkey
      FOREIGN KEY (roster_id)
      REFERENCES public.imported_rosters(id)
      ON DELETE CASCADE;
  END IF;
END $$;