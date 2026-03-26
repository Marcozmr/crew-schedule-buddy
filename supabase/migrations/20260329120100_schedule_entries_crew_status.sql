-- Situação do tripulante e tipo de entrada (parser CrewRoster LATAM)
ALTER TABLE public.schedule_entries
  ADD COLUMN IF NOT EXISTS entry_type text,
  ADD COLUMN IF NOT EXISTS crew_status_code text,
  ADD COLUMN IF NOT EXISTS crew_status_label text,
  ADD COLUMN IF NOT EXISTS activity_label text;

COMMENT ON COLUMN public.schedule_entries.entry_type IS 'flight | day_off | reserve | standby | on_call | duty_start | other_activity';
COMMENT ON COLUMN public.schedule_entries.crew_status_code IS 'Código bruto (OP, PS, DO, HSB, …)';
COMMENT ON COLUMN public.schedule_entries.crew_status_label IS 'Rótulo amigável para a UI (pt-BR)';
COMMENT ON COLUMN public.schedule_entries.activity_label IS 'Descrição curta da atividade quando não for voo';
