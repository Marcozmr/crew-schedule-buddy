-- Permite sessões de automação para GOL e Azul (além de LATAM).

ALTER TABLE public.automation_sessions DROP CONSTRAINT IF EXISTS automation_sessions_provider_check;

ALTER TABLE public.automation_sessions
  ADD CONSTRAINT automation_sessions_provider_check CHECK (provider IN ('latam', 'gol', 'azul'));
