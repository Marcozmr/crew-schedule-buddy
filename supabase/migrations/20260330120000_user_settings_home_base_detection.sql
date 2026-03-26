-- Detecção automática de base operacional + preferência manual explícita
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS detected_base_airport text,
  ADD COLUMN IF NOT EXISTS home_base_source text,
  ADD COLUMN IF NOT EXISTS home_base_user_locked boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_settings.detected_base_airport IS 'Última base inferida ou lida do roster (auditoria)';
COMMENT ON COLUMN public.user_settings.home_base_source IS 'manual | portal | pdf | manual_text | inferred';
COMMENT ON COLUMN public.user_settings.home_base_user_locked IS 'Se true, base_airport não é sobrescrita por detecção automática';
