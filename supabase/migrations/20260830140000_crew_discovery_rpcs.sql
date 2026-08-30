-- RPCs de descoberta entre colegas — cada uma só revela dados de OUTRO usuário quando o próprio
-- chamador (auth.uid()) já está naquele voo específico, ou já é uma crew_flight_connections
-- confirmada com o parceiro. Nunca expõe a escala completa de ninguém.

-- 1) Tripulantes (outros usuários do EscalaX) num voo específico — mostrado ao expandir o voo.
CREATE OR REPLACE FUNCTION public.get_flight_crewmates(p_date text, p_flight_number text, p_departure text)
RETURNS TABLE (user_id uuid, name text, airline text, crew_role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- só responde se o próprio chamador estiver nesse voo (evita sondar voos alheios)
  IF NOT EXISTS (
    SELECT 1 FROM public.schedule_entries se
    WHERE se.user_id = auth.uid()
      AND se.date = p_date
      AND upper(btrim(se.flight_number)) = upper(btrim(p_flight_number))
      AND upper(btrim(coalesce(se.departure, ''))) = upper(btrim(coalesce(p_departure, '')))
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT se.user_id, COALESCE(NULLIF(btrim(p.name), ''), 'Tripulante'), p.airline, se.crew_role
  FROM public.schedule_entries se
  JOIN public.profiles p ON p.user_id = se.user_id
  WHERE se.user_id <> auth.uid()
    AND se.date = p_date
    AND upper(btrim(se.flight_number)) = upper(btrim(p_flight_number))
    AND upper(btrim(coalesce(se.departure, ''))) = upper(btrim(coalesce(p_departure, '')))
    AND (se.entry_type IS NULL OR se.entry_type = 'flight');
END;
$$;

REVOKE ALL ON FUNCTION public.get_flight_crewmates(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_flight_crewmates(text, text, text) TO authenticated;

-- 2) Dias de folga em comum com um colega já conectado (crew_flight_connections confirmada).
CREATE OR REPLACE FUNCTION public.get_shared_days_off(p_partner_id uuid)
RETURNS TABLE (day_off date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  ua uuid;
  ub uuid;
BEGIN
  IF auth.uid() IS NULL OR p_partner_id IS NULL THEN
    RETURN;
  END IF;

  ua := LEAST(auth.uid(), p_partner_id);
  ub := GREATEST(auth.uid(), p_partner_id);

  IF NOT EXISTS (SELECT 1 FROM public.crew_flight_connections c WHERE c.user_a_id = ua AND c.user_b_id = ub) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT mine.date::date
  FROM public.schedule_entries mine
  JOIN public.schedule_entries theirs
    ON theirs.date = mine.date AND theirs.user_id = p_partner_id
  WHERE mine.user_id = auth.uid()
    AND mine.entry_type = 'day_off'
    AND theirs.entry_type = 'day_off'
    AND mine.date >= to_char(now(), 'YYYY-MM-DD')
  ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_days_off(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_days_off(uuid) TO authenticated;

-- 3) Pernoites (layovers) na mesma cidade e data com um colega já conectado.
CREATE OR REPLACE FUNCTION public.get_shared_layovers(p_partner_id uuid)
RETURNS TABLE (layover_date date, city text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  ua uuid;
  ub uuid;
BEGIN
  IF auth.uid() IS NULL OR p_partner_id IS NULL THEN
    RETURN;
  END IF;

  ua := LEAST(auth.uid(), p_partner_id);
  ub := GREATEST(auth.uid(), p_partner_id);

  IF NOT EXISTS (SELECT 1 FROM public.crew_flight_connections c WHERE c.user_a_id = ua AND c.user_b_id = ub) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT mine.date::date, upper(btrim(coalesce(mine.arrival_airport, mine.arrival)))
  FROM public.schedule_entries mine
  JOIN public.schedule_entries theirs
    ON theirs.date = mine.date
    AND theirs.user_id = p_partner_id
    AND theirs.overnight IS TRUE
    AND upper(btrim(coalesce(theirs.arrival_airport, theirs.arrival))) = upper(btrim(coalesce(mine.arrival_airport, mine.arrival)))
  WHERE mine.user_id = auth.uid()
    AND mine.overnight IS TRUE
    AND mine.date >= to_char(now(), 'YYYY-MM-DD')
    AND coalesce(mine.arrival_airport, mine.arrival) IS NOT NULL
  ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_layovers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_layovers(uuid) TO authenticated;
