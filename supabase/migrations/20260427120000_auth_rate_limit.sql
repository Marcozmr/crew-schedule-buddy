-- Rate limiting para fluxos de autenticação (camada servidor).
-- Apenas service_role (Edge Function) pode ler/escrever e chamar a função RPC.

CREATE TABLE IF NOT EXISTS public.auth_rate_limit_buckets (
  bucket_key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limit_buckets_updated_at
  ON public.auth_rate_limit_buckets (updated_at);

COMMENT ON TABLE public.auth_rate_limit_buckets IS
  'Contadores por janela fixa para rate limit de auth; acesso apenas via service_role.';

ALTER TABLE public.auth_rate_limit_buckets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.auth_rate_limit_buckets FROM PUBLIC;
REVOKE ALL ON public.auth_rate_limit_buckets FROM anon;
REVOKE ALL ON public.auth_rate_limit_buckets FROM authenticated;

-- Tenta incrementar dentro da janela; devolve false se o limite já foi atingido (sem incrementar).
CREATE OR REPLACE FUNCTION public._auth_rate_limit_try_increment(
  p_bucket_key text,
  p_max_requests integer,
  p_window interval,
  p_now timestamptz
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.auth_rate_limit_buckets%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.auth_rate_limit_buckets
  WHERE bucket_key = p_bucket_key
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.auth_rate_limit_buckets (bucket_key, window_start, request_count, updated_at)
    VALUES (p_bucket_key, p_now, 1, p_now);
    RETURN true;
  END IF;

  IF v_row.window_start + p_window <= p_now THEN
    UPDATE public.auth_rate_limit_buckets
    SET window_start = p_now, request_count = 1, updated_at = p_now
    WHERE bucket_key = p_bucket_key;
    RETURN true;
  END IF;

  IF v_row.request_count >= p_max_requests THEN
    RETURN false;
  END IF;

  UPDATE public.auth_rate_limit_buckets
  SET request_count = v_row.request_count + 1, updated_at = p_now
  WHERE bucket_key = p_bucket_key;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public._auth_rate_limit_try_increment(text, integer, interval, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._auth_rate_limit_try_increment(text, integer, interval, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public._auth_rate_limit_try_increment(text, integer, interval, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._auth_rate_limit_try_increment(text, integer, interval, timestamptz) TO service_role;

-- Política (signup, login, forgot_password, resend_confirmation): IP + email quando existir.
CREATE OR REPLACE FUNCTION public.auth_rate_limit_check(
  p_action text,
  p_ip text,
  p_email text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_ip text := nullif(trim(coalesce(p_ip, '')), '');
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_ip_key text;
  v_email_key text;
  v_max_ip int;
  v_max_email int;
  v_win_ip interval;
  v_win_email interval;
BEGIN
  IF v_ip IS NULL OR v_ip = '' THEN
    v_ip := 'unknown';
  END IF;

  IF p_action NOT IN ('signup', 'login', 'forgot_password', 'resend_confirmation') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_action');
  END IF;

  CASE p_action
    WHEN 'signup' THEN
      v_max_ip := 5;
      v_win_ip := interval '1 hour';
      v_max_email := 3;
      v_win_email := interval '1 hour';
    WHEN 'login' THEN
      v_max_ip := 30;
      v_win_ip := interval '1 minute';
      v_max_email := 10;
      v_win_email := interval '1 minute';
    WHEN 'forgot_password' THEN
      v_max_ip := 5;
      v_win_ip := interval '1 hour';
      v_max_email := 3;
      v_win_email := interval '1 hour';
    WHEN 'resend_confirmation' THEN
      v_max_ip := 3;
      v_win_ip := interval '1 hour';
      v_max_email := 2;
      v_win_email := interval '1 hour';
    ELSE
      RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_action');
  END CASE;

  v_ip_key := p_action || ':ip:' || v_ip;

  IF v_email IS NOT NULL AND v_email <> '' THEN
    v_email_key := p_action || ':email:' || v_email;
    -- Email primeiro (limite mais restritivo por identidade), depois IP.
    IF NOT public._auth_rate_limit_try_increment(v_email_key, v_max_email, v_win_email, v_now) THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'rate_limit');
    END IF;
  END IF;

  IF NOT public._auth_rate_limit_try_increment(v_ip_key, v_max_ip, v_win_ip, v_now) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'rate_limit');
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

REVOKE ALL ON FUNCTION public.auth_rate_limit_check(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_rate_limit_check(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.auth_rate_limit_check(text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.auth_rate_limit_check(text, text, text) TO service_role;
