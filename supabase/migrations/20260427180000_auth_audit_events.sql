-- Auditoria de eventos de autenticação (append-only, sem dados sensíveis na metadata).
-- Inserção apenas via RPC SECURITY DEFINER; leitura reservada a service_role / operação.

CREATE TABLE IF NOT EXISTS public.auth_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_name text NOT NULL,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  client_route text,
  client_origin text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT auth_audit_events_metadata_size CHECK (octet_length(metadata::text) <= 14000)
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_events_created_at ON public.auth_audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_events_event_name ON public.auth_audit_events (event_name);
CREATE INDEX IF NOT EXISTS idx_auth_audit_events_user_id ON public.auth_audit_events (user_id) WHERE user_id IS NOT NULL;

COMMENT ON TABLE public.auth_audit_events IS
  'Eventos de auth (nome + metadata sanitizada). user_id = auth.uid() na altura do pedido.';

ALTER TABLE public.auth_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.auth_audit_events FROM PUBLIC;
REVOKE ALL ON public.auth_audit_events FROM anon;
REVOKE ALL ON public.auth_audit_events FROM authenticated;

GRANT SELECT ON public.auth_audit_events TO service_role;

CREATE OR REPLACE FUNCTION public.log_auth_audit_event(
  p_event_name text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_route text DEFAULT NULL,
  p_origin text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed text[] := ARRAY[
    'signup_requested',
    'signup_completed',
    'email_confirmation_sent',
    'email_confirmed',
    'login_succeeded',
    'login_failed',
    'password_reset_requested',
    'password_reset_completed',
    'password_reset_failed',
    'password_reset_rate_limited',
    'resend_confirmation_requested',
    'resend_confirmation_succeeded',
    'resend_confirmation_failed',
    'blocked_unconfirmed_user',
    'logout',
    'auth_callback_error'
  ];
BEGIN
  IF p_event_name IS NULL OR array_position(v_allowed, p_event_name) IS NULL THEN
    RAISE EXCEPTION 'invalid auth audit event';
  END IF;

  INSERT INTO public.auth_audit_events (
    event_name,
    user_id,
    client_route,
    client_origin,
    metadata
  )
  VALUES (
    p_event_name,
    auth.uid(),
    left(coalesce(p_route, ''), 512),
    left(coalesce(p_origin, ''), 512),
    coalesce(p_metadata, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_auth_audit_event(text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_auth_audit_event(text, jsonb, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.log_auth_audit_event(text, jsonb, text, text) TO authenticated;
