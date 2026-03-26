-- Estado explícito: após portal reconhecido, aguarda SAB + iFlight (sem automação).
ALTER TABLE public.user_roster_connection
  DROP CONSTRAINT IF EXISTS user_roster_connection_roster_connection_state_check;

ALTER TABLE public.user_roster_connection
  ADD CONSTRAINT user_roster_connection_roster_connection_state_check
  CHECK (roster_connection_state IN (
    'idle',
    'portal_connected',
    'awaiting_iflight_roster',
    'iflight_accessed',
    'roster_connected'
  ));

COMMENT ON COLUMN public.user_roster_connection.roster_connection_state IS
  'idle | portal_connected | awaiting_iflight_roster | iflight_accessed | roster_connected — fluxo orientado, sem automação de portal.';

-- Quem já estava em portal_connected sem escala importada passa ao novo estado guiado.
UPDATE public.user_roster_connection
SET roster_connection_state = 'awaiting_iflight_roster'
WHERE roster_connection_state = 'portal_connected'
  AND current_active_roster_id IS NULL;
