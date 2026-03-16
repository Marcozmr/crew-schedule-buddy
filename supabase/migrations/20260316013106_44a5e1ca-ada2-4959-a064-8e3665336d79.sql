
ALTER TABLE public.imported_rosters ADD COLUMN IF NOT EXISTS crew_group_code text;
ALTER TABLE public.imported_rosters ADD COLUMN IF NOT EXISTS raw_text_excerpt text;

ALTER TABLE public.schedule_entries ADD COLUMN IF NOT EXISTS assignment text;
ALTER TABLE public.schedule_entries ADD COLUMN IF NOT EXISTS sort_datetime timestamptz;
