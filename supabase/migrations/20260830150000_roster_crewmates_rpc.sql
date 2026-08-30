-- Tripulantes de toda a escala ativa (voos futuros) do usuário — usado logo após importar.
-- Mesma regra de privacidade das outras RPCs de descoberta: só enxerga quem está no MESMO
-- voo que o próprio chamador (nunca a escala completa de outro usuário).
CREATE OR REPLACE FUNCTION public.get_roster_crewmates()
RETURNS TABLE (
  flight_date text,
  flight_number text,
  departure text,
  arrival text,
  partner_user_id uuid,
  partner_name text,
  partner_airline text,
  crew_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT
    mine.date,
    upper(btrim(mine.flight_number)),
    mine.departure,
    mine.arrival,
    theirs.user_id,
    COALESCE(NULLIF(btrim(p.name), ''), 'Tripulante'),
    p.airline,
    theirs.crew_role
  FROM public.schedule_entries mine
  JOIN public.schedule_entries theirs
    ON theirs.date = mine.date
    AND upper(btrim(theirs.flight_number)) = upper(btrim(mine.flight_number))
    AND upper(btrim(coalesce(theirs.departure, ''))) = upper(btrim(coalesce(mine.departure, '')))
    AND theirs.user_id <> mine.user_id
    AND (theirs.entry_type IS NULL OR theirs.entry_type = 'flight')
  JOIN public.profiles p ON p.user_id = theirs.user_id
  WHERE mine.user_id = auth.uid()
    AND (mine.entry_type IS NULL OR mine.entry_type = 'flight')
    AND mine.flight_number IS NOT NULL
    AND btrim(mine.flight_number) <> ''
    AND mine.date >= to_char(now(), 'YYYY-MM-DD')
  ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_roster_crewmates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_roster_crewmates() TO authenticated;
