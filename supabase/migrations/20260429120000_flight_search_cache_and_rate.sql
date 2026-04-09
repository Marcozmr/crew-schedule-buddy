-- Cache partilhado para busca livre (Flight Board) + limite diário por utilizador autenticado.

CREATE TABLE IF NOT EXISTS public.flights_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  mode text NOT NULL CHECK (mode IN ('flight', 'airport')),
  airport text,
  direction text CHECK (direction IS NULL OR direction IN ('departure', 'arrival')),
  airline text,
  flight_number text,
  flight_date date NOT NULL,
  response_json jsonb NOT NULL,
  source text NOT NULL DEFAULT 'opensky',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flights_cache_response_size CHECK (octet_length(response_json::text) <= 512000)
);

CREATE INDEX IF NOT EXISTS idx_flights_cache_key_updated ON public.flights_cache (cache_key, updated_at DESC);

COMMENT ON TABLE public.flights_cache IS
  'Respostas normalizadas da busca livre; TTL lógico na edge (~12 min). Acesso só service_role.';

ALTER TABLE public.flights_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flights_cache FROM PUBLIC;
REVOKE ALL ON public.flights_cache FROM anon;
REVOKE ALL ON public.flights_cache FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flights_cache TO service_role;

CREATE TABLE IF NOT EXISTS public.flight_search_daily_usage (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  search_count integer NOT NULL DEFAULT 0 CHECK (search_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_flight_search_usage_date ON public.flight_search_daily_usage (usage_date DESC);

COMMENT ON TABLE public.flight_search_daily_usage IS
  'Contador diário (UTC) de buscas flight-search por utilizador; apenas service_role.';

ALTER TABLE public.flight_search_daily_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flight_search_daily_usage FROM PUBLIC;
REVOKE ALL ON public.flight_search_daily_usage FROM anon;
REVOKE ALL ON public.flight_search_daily_usage FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flight_search_daily_usage TO service_role;

CREATE OR REPLACE FUNCTION public.flight_search_try_increment(p_user_id uuid, p_daily_limit integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date := (timezone('utc', now()))::date;
  v_count integer;
BEGIN
  IF p_daily_limit IS NULL OR p_daily_limit < 1 THEN
    p_daily_limit := 10;
  END IF;

  SELECT search_count INTO v_count
  FROM public.flight_search_daily_usage
  WHERE user_id = p_user_id AND usage_date = d
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.flight_search_daily_usage (user_id, usage_date, search_count, updated_at)
    VALUES (p_user_id, d, 1, now());
    RETURN jsonb_build_object(
      'allowed', true,
      'count', 1,
      'limit', p_daily_limit,
      'remaining', p_daily_limit - 1
    );
  END IF;

  IF v_count >= p_daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'count', v_count,
      'limit', p_daily_limit,
      'remaining', 0
    );
  END IF;

  UPDATE public.flight_search_daily_usage
  SET search_count = search_count + 1, updated_at = now()
  WHERE user_id = p_user_id AND usage_date = d
  RETURNING search_count INTO v_count;

  RETURN jsonb_build_object(
    'allowed', true,
    'count', v_count,
    'limit', p_daily_limit,
    'remaining', p_daily_limit - v_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.flight_search_try_increment(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.flight_search_try_increment(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.flight_search_try_increment(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.flight_search_try_increment(uuid, integer) TO service_role;
