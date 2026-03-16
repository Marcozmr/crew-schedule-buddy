
-- Add new columns to schedule_entries
ALTER TABLE public.schedule_entries
  ADD COLUMN IF NOT EXISTS roster_id uuid REFERENCES public.imported_rosters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS activity_type text NOT NULL DEFAULT 'flight',
  ADD COLUMN IF NOT EXISTS is_flight boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pairing_code text,
  ADD COLUMN IF NOT EXISTS crew_role text,
  ADD COLUMN IF NOT EXISTS operation_type text,
  ADD COLUMN IF NOT EXISTS departure_airport text,
  ADD COLUMN IF NOT EXISTS arrival_airport text,
  ADD COLUMN IF NOT EXISTS debrief_time text,
  ADD COLUMN IF NOT EXISTS flight_hours numeric,
  ADD COLUMN IF NOT EXISTS aircraft_type text,
  ADD COLUMN IF NOT EXISTS hotel_name text,
  ADD COLUMN IF NOT EXISTS comments text,
  ADD COLUMN IF NOT EXISTS raw_line text,
  ADD COLUMN IF NOT EXISTS source_pdf_path text,
  ADD COLUMN IF NOT EXISTS crosses_midnight boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS overnight boolean DEFAULT false;

-- Add new columns to imported_rosters
ALTER TABLE public.imported_rosters
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS employee_code text,
  ADD COLUMN IF NOT EXISTS base_airport text,
  ADD COLUMN IF NOT EXISTS crew_role text,
  ADD COLUMN IF NOT EXISTS roster_start_date text,
  ADD COLUMN IF NOT EXISTS roster_end_date text,
  ADD COLUMN IF NOT EXISTS flying_hours_total numeric,
  ADD COLUMN IF NOT EXISTS duty_hours_total numeric,
  ADD COLUMN IF NOT EXISTS parser_version text DEFAULT '2.0',
  ADD COLUMN IF NOT EXISTS import_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS import_error text,
  ADD COLUMN IF NOT EXISTS parsed_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inserted_count integer DEFAULT 0;
