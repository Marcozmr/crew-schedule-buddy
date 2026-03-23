-- Operacao continua: status operacional do portal e metadados de tracking.

ALTER TABLE public.portal_connections
  ADD COLUMN IF NOT EXISTS sync_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reconnect_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_sync_attempt_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_reconnect_attempt_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS next_sync_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS sync_error text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'portal_connections_connection_status_ops_chk'
  ) THEN
    ALTER TABLE public.portal_connections
      ADD CONSTRAINT portal_connections_connection_status_ops_chk
      CHECK (
        connection_status IN (
          'connected',
          'syncing',
          'pending',
          'disconnected',
          'unavailable',
          'expired',
          'reconnect_required',
          'failed'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_portal_connections_user_next_sync
  ON public.portal_connections(user_id, next_sync_at);

ALTER TABLE public.schedule_entries
  ADD COLUMN IF NOT EXISTS next_tracking_check_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS tracking_priority text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'schedule_entries_tracking_priority_chk'
  ) THEN
    ALTER TABLE public.schedule_entries
      ADD CONSTRAINT schedule_entries_tracking_priority_chk
      CHECK (
        tracking_priority IS NULL
        OR tracking_priority IN ('none', 'low', 'moderate', 'high', 'max')
      );
  END IF;
END $$;
