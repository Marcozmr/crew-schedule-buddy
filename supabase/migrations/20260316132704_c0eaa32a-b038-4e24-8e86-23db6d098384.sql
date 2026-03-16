
-- Documents table
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'OUTROS',
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  notes text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own documents" ON public.documents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Salary entries table
CREATE TABLE public.salary_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reference_month text NOT NULL,
  base_salary numeric DEFAULT 0,
  per_diem_total numeric DEFAULT 0,
  overnight_total numeric DEFAULT 0,
  night_additional numeric DEFAULT 0,
  productivity_bonus numeric DEFAULT 0,
  other_additions numeric DEFAULT 0,
  inss numeric DEFAULT 0,
  irrf numeric DEFAULT 0,
  health_plan numeric DEFAULT 0,
  other_discounts numeric DEFAULT 0,
  gross_total numeric DEFAULT 0,
  net_total numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.salary_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own salary" ON public.salary_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_salary_entries_updated_at BEFORE UPDATE ON public.salary_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per diem entries table
CREATE TABLE public.perdiem_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date text NOT NULL,
  location text,
  quantity numeric DEFAULT 1,
  unit_value numeric DEFAULT 0,
  total_value numeric DEFAULT 0,
  related_schedule_entry_id uuid REFERENCES public.schedule_entries(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.perdiem_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own perdiem" ON public.perdiem_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Flight swap requests table
CREATE TABLE public.flight_swap_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  schedule_entry_id uuid REFERENCES public.schedule_entries(id) ON DELETE SET NULL,
  flight_number text,
  flight_date text,
  status text NOT NULL DEFAULT 'aberta',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.flight_swap_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own swaps" ON public.flight_swap_requests FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_flight_swap_updated_at BEFORE UPDATE ON public.flight_swap_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User settings table
CREATE TABLE public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  base_airport text,
  crew_role text,
  company_name text,
  timezone text DEFAULT 'America/Sao_Paulo',
  notifications_enabled boolean DEFAULT true,
  theme text DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own settings" ON public.user_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Weather recent searches
CREATE TABLE public.weather_recent_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  airport_code text NOT NULL,
  searched_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.weather_recent_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own searches" ON public.weather_recent_searches FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Regulation rules (configurable)
CREATE TABLE public.regulation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type text NOT NULL,
  crew_type text,
  rest_class text,
  stage_count integer,
  period_type text,
  max_duty_hours numeric,
  max_flight_hours numeric,
  min_rest_hours numeric,
  is_active boolean DEFAULT true
);
ALTER TABLE public.regulation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active rules" ON public.regulation_rules FOR SELECT USING (is_active = true);

-- Regulation alerts
CREATE TABLE public.regulation_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  roster_id uuid REFERENCES public.imported_rosters(id) ON DELETE CASCADE,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  description text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean DEFAULT true
);
ALTER TABLE public.regulation_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own reg alerts" ON public.regulation_alerts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Users can upload own documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own documents" ON storage.objects FOR SELECT USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own documents" ON storage.objects FOR DELETE USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
