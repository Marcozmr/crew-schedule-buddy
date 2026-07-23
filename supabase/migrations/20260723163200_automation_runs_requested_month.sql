-- Mês da escala escolhido pelo utilizador no diálogo de importação (Fontes de escala).
-- Nulo em execuções automáticas silenciosas (auto-sync/app-load), que continuam pegando
-- o que o iFlight Neo mostrar por padrão — mesmo comportamento de antes desta coluna.

ALTER TABLE public.automation_runs
  ADD COLUMN IF NOT EXISTS requested_month text;

ALTER TABLE public.automation_runs
  DROP CONSTRAINT IF EXISTS automation_runs_requested_month_format;

ALTER TABLE public.automation_runs
  ADD CONSTRAINT automation_runs_requested_month_format
  CHECK (requested_month IS NULL OR requested_month ~ '^\d{4}-(0[1-9]|1[0-2])$');

COMMENT ON COLUMN public.automation_runs.requested_month IS
  'Mês solicitado pelo utilizador (YYYY-MM) no diálogo de seleção antes da importação; nulo em kicks automáticos.';
