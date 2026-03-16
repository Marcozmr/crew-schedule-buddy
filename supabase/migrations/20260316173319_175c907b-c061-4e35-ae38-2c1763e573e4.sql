
-- Add onboarding tracking columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_step integer NOT NULL DEFAULT 0;

-- Performance indexes for scale (10k users)
CREATE INDEX IF NOT EXISTS idx_schedule_entries_user_date ON public.schedule_entries (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_roster_id ON public.schedule_entries (roster_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications (user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_imported_rosters_user_active ON public.imported_rosters (user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_flight_swap_offers_status ON public.flight_swap_offers (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings (user_id);
CREATE INDEX IF NOT EXISTS idx_perdiem_entries_user_date ON public.perdiem_entries (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_salary_entries_user_month ON public.salary_entries (user_id, reference_month DESC);
