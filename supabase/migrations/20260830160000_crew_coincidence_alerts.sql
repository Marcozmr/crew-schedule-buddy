-- Alertas de coincidência: folga e pernoite em comum com um colega já conectado
-- (mesma regra de privacidade — só entre pares com crew_flight_connections confirmada).
-- Cada coincidência notifica só uma vez (tabela de dedupe com UNIQUE), como o
-- detect_crew_connections já faz para voos em comum.

CREATE TABLE IF NOT EXISTS public.crew_days_off_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_off date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crew_days_off_matches_user_order CHECK (user_a_id < user_b_id),
  CONSTRAINT crew_days_off_matches_unique UNIQUE (user_a_id, user_b_id, day_off)
);

ALTER TABLE public.crew_days_off_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own days-off matches"
ON public.crew_days_off_matches FOR SELECT
USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE TABLE IF NOT EXISTS public.crew_layover_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  layover_date date NOT NULL,
  city text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crew_layover_matches_user_order CHECK (user_a_id < user_b_id),
  CONSTRAINT crew_layover_matches_unique UNIQUE (user_a_id, user_b_id, layover_date, city)
);

ALTER TABLE public.crew_layover_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own layover matches"
ON public.crew_layover_matches FOR SELECT
USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- Folga em comum
CREATE OR REPLACE FUNCTION public.detect_days_off_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  partner RECORD;
  ua uuid;
  ub uuid;
  v_match_id uuid;
  partner_name text;
  self_name text;
  day_label text;
BEGIN
  IF NEW.entry_type IS DISTINCT FROM 'day_off' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.date IS NOT DISTINCT FROM OLD.date AND NEW.entry_type IS NOT DISTINCT FROM OLD.entry_type THEN
    RETURN NEW;
  END IF;

  day_label := to_char(NEW.date::date, 'DD/MM/YYYY');

  FOR partner IN
    SELECT DISTINCT CASE WHEN c.user_a_id = NEW.user_id THEN c.user_b_id ELSE c.user_a_id END AS user_id
    FROM public.crew_flight_connections c
    WHERE c.user_a_id = NEW.user_id OR c.user_b_id = NEW.user_id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.schedule_entries se
      WHERE se.user_id = partner.user_id AND se.date = NEW.date AND se.entry_type = 'day_off'
    ) THEN
      CONTINUE;
    END IF;

    ua := LEAST(NEW.user_id, partner.user_id);
    ub := GREATEST(NEW.user_id, partner.user_id);

    v_match_id := NULL;
    INSERT INTO public.crew_days_off_matches (user_a_id, user_b_id, day_off)
    VALUES (ua, ub, NEW.date::date)
    ON CONFLICT (user_a_id, user_b_id, day_off) DO NOTHING
    RETURNING id INTO v_match_id;

    IF v_match_id IS NOT NULL THEN
      SELECT COALESCE(NULLIF(btrim(p.name), ''), 'seu colega') INTO partner_name FROM public.profiles p WHERE p.user_id = partner.user_id;
      SELECT COALESCE(NULLIF(btrim(p.name), ''), 'seu colega') INTO self_name FROM public.profiles p WHERE p.user_id = NEW.user_id;

      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (NEW.user_id, 'Folga em comum com ' || partner_name,
        'Você e ' || partner_name || ' estão de folga no mesmo dia: ' || day_label || '.', 'info');

      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (partner.user_id, 'Folga em comum com ' || self_name,
        'Você e ' || self_name || ' estão de folga no mesmo dia: ' || day_label || '.', 'info');
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_detect_days_off_match ON public.schedule_entries;
CREATE TRIGGER trg_detect_days_off_match
  AFTER INSERT OR UPDATE ON public.schedule_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_days_off_match();

-- Pernoite (layover) em comum
CREATE OR REPLACE FUNCTION public.detect_layover_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  partner RECORD;
  ua uuid;
  ub uuid;
  v_match_id uuid;
  partner_name text;
  self_name text;
  city_val text;
  day_label text;
BEGIN
  IF NEW.overnight IS NOT TRUE OR coalesce(NEW.arrival_airport, NEW.arrival) IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.date IS NOT DISTINCT FROM OLD.date
     AND NEW.overnight IS NOT DISTINCT FROM OLD.overnight
     AND coalesce(NEW.arrival_airport, NEW.arrival) IS NOT DISTINCT FROM coalesce(OLD.arrival_airport, OLD.arrival) THEN
    RETURN NEW;
  END IF;

  city_val := upper(btrim(coalesce(NEW.arrival_airport, NEW.arrival)));
  day_label := to_char(NEW.date::date, 'DD/MM/YYYY');

  FOR partner IN
    SELECT DISTINCT CASE WHEN c.user_a_id = NEW.user_id THEN c.user_b_id ELSE c.user_a_id END AS user_id
    FROM public.crew_flight_connections c
    WHERE c.user_a_id = NEW.user_id OR c.user_b_id = NEW.user_id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.schedule_entries se
      WHERE se.user_id = partner.user_id
        AND se.date = NEW.date
        AND se.overnight IS TRUE
        AND upper(btrim(coalesce(se.arrival_airport, se.arrival))) = city_val
    ) THEN
      CONTINUE;
    END IF;

    ua := LEAST(NEW.user_id, partner.user_id);
    ub := GREATEST(NEW.user_id, partner.user_id);

    v_match_id := NULL;
    INSERT INTO public.crew_layover_matches (user_a_id, user_b_id, layover_date, city)
    VALUES (ua, ub, NEW.date::date, city_val)
    ON CONFLICT (user_a_id, user_b_id, layover_date, city) DO NOTHING
    RETURNING id INTO v_match_id;

    IF v_match_id IS NOT NULL THEN
      SELECT COALESCE(NULLIF(btrim(p.name), ''), 'seu colega') INTO partner_name FROM public.profiles p WHERE p.user_id = partner.user_id;
      SELECT COALESCE(NULLIF(btrim(p.name), ''), 'seu colega') INTO self_name FROM public.profiles p WHERE p.user_id = NEW.user_id;

      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (NEW.user_id, 'Pernoite em comum com ' || partner_name,
        'Você e ' || partner_name || ' vão pernoitar em ' || city_val || ' no dia ' || day_label || '.', 'info');

      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (partner.user_id, 'Pernoite em comum com ' || self_name,
        'Você e ' || self_name || ' vão pernoitar em ' || city_val || ' no dia ' || day_label || '.', 'info');
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_detect_layover_match ON public.schedule_entries;
CREATE TRIGGER trg_detect_layover_match
  AFTER INSERT OR UPDATE ON public.schedule_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_layover_match();

-- Lista de parceiros (crew_flight_connections) com nome/companhia — usada pelas novas telas
-- de Conexões (colegas, folgas em comum, pernoites em comum).
CREATE OR REPLACE FUNCTION public.list_crew_connections()
RETURNS TABLE (
  partner_user_id uuid,
  partner_name text,
  partner_airline text,
  flights_together_count integer,
  has_conversation boolean,
  conversation_id uuid
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
  SELECT
    partner_id,
    COALESCE(NULLIF(btrim(p.name), ''), 'Colega de voo'),
    p.airline,
    count(*)::integer,
    (conv.id IS NOT NULL),
    conv.id
  FROM (
    SELECT CASE WHEN c.user_a_id = auth.uid() THEN c.user_b_id ELSE c.user_a_id END AS partner_id
    FROM public.crew_flight_connections c
    WHERE c.user_a_id = auth.uid() OR c.user_b_id = auth.uid()
  ) matches
  JOIN public.profiles p ON p.user_id = matches.partner_id
  LEFT JOIN public.crew_conversations conv
    ON conv.user_a_id = LEAST(auth.uid(), matches.partner_id)
    AND conv.user_b_id = GREATEST(auth.uid(), matches.partner_id)
  GROUP BY partner_id, p.name, p.airline, conv.id
  ORDER BY count(*) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_crew_connections() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_crew_connections() TO authenticated;
