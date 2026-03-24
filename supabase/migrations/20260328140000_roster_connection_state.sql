-- Fluxo explícito: portal → iFlight (manual) → importação CrewRosterReport
ALTER TABLE public.user_roster_connection
  ADD COLUMN IF NOT EXISTS roster_connection_state text NOT NULL DEFAULT 'idle';

ALTER TABLE public.user_roster_connection
  DROP CONSTRAINT IF EXISTS user_roster_connection_roster_connection_state_check;

ALTER TABLE public.user_roster_connection
  ADD CONSTRAINT user_roster_connection_roster_connection_state_check
  CHECK (roster_connection_state IN (
    'idle',
    'portal_connected',
    'iflight_accessed',
    'roster_connected'
  ));

COMMENT ON COLUMN public.user_roster_connection.roster_connection_state IS
  'idle | portal_connected | iflight_accessed | roster_connected — fluxo honesto sem automação de portal.';

UPDATE public.user_roster_connection
SET roster_connection_state = 'roster_connected'
WHERE connection_status = 'connected'
  AND current_active_roster_id IS NOT NULL;
