-- Reconhecimento de colegas de voo: quando dois usuários do EscalaX têm o mesmo voo
-- (data + número + origem) na escala, registra o histórico de voos em comum e, a partir
-- da 2ª vez que voarem juntos, notifica os dois via a tabela `notifications` já existente.

CREATE TABLE IF NOT EXISTS public.crew_flight_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- user_a_id sempre o menor UUID, user_b_id o maior — evita duplicar (A,B) e (B,A).
  user_a_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flight_date text NOT NULL,
  flight_number text NOT NULL,
  airline text,
  departure text,
  arrival text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crew_flight_connections_user_order CHECK (user_a_id < user_b_id),
  CONSTRAINT crew_flight_connections_unique UNIQUE (user_a_id, user_b_id, flight_date, flight_number, departure)
);

COMMENT ON TABLE public.crew_flight_connections IS
  'Um registro por voo em comum entre dois usuários (mesma data+voo+origem). Alimentada só pelo trigger detect_crew_connections — sem insert/update/delete direto do cliente.';

ALTER TABLE public.crew_flight_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own crew connections"
ON public.crew_flight_connections
FOR SELECT
USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE INDEX IF NOT EXISTS idx_crew_flight_connections_user_a
  ON public.crew_flight_connections (user_a_id, flight_date DESC);
CREATE INDEX IF NOT EXISTS idx_crew_flight_connections_user_b
  ON public.crew_flight_connections (user_b_id, flight_date DESC);

-- Acelera a busca do trigger por "outro usuário no mesmo voo".
CREATE INDEX IF NOT EXISTS idx_schedule_entries_flight_match
  ON public.schedule_entries (date, flight_number);

CREATE OR REPLACE FUNCTION public.detect_crew_connections()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  partner RECORD;
  ua uuid;
  ub uuid;
  prior_count integer;
  v_conn_id uuid;
  partner_name text;
  self_name text;
  flight_label text;
BEGIN
  -- Só voos reais com número preenchido (ignora folga/reserva/standby/etc.).
  IF NEW.flight_number IS NULL OR btrim(NEW.flight_number) = '' THEN
    RETURN NEW;
  END IF;
  IF NEW.entry_type IS NOT NULL AND NEW.entry_type <> 'flight' THEN
    RETURN NEW;
  END IF;

  -- Em UPDATE, só reavalia se algo relevante ao match mudou (OLD só existe em UPDATE —
  -- IF aninhado evita acessar OLD num trigger de INSERT).
  IF TG_OP = 'UPDATE' THEN
    IF NEW.date IS NOT DISTINCT FROM OLD.date
       AND NEW.flight_number IS NOT DISTINCT FROM OLD.flight_number
       AND NEW.departure IS NOT DISTINCT FROM OLD.departure THEN
      RETURN NEW;
    END IF;
  END IF;

  flight_label := upper(btrim(NEW.flight_number)) || ' (' || NEW.date || ')';

  FOR partner IN
    SELECT DISTINCT se.user_id
    FROM public.schedule_entries se
    WHERE se.user_id <> NEW.user_id
      AND se.date = NEW.date
      AND upper(btrim(se.flight_number)) = upper(btrim(NEW.flight_number))
      AND upper(btrim(coalesce(se.departure, ''))) = upper(btrim(coalesce(NEW.departure, '')))
      AND (se.entry_type IS NULL OR se.entry_type = 'flight')
  LOOP
    ua := LEAST(NEW.user_id, partner.user_id);
    ub := GREATEST(NEW.user_id, partner.user_id);

    SELECT count(*) INTO prior_count
    FROM public.crew_flight_connections c
    WHERE c.user_a_id = ua AND c.user_b_id = ub;

    v_conn_id := NULL;
    INSERT INTO public.crew_flight_connections
      (user_a_id, user_b_id, flight_date, flight_number, airline, departure, arrival)
    VALUES
      (ua, ub, NEW.date, upper(btrim(NEW.flight_number)), NEW.airline, NEW.departure, NEW.arrival)
    ON CONFLICT (user_a_id, user_b_id, flight_date, flight_number, departure) DO NOTHING
    RETURNING id INTO v_conn_id;

    -- Só notifica se: (a) é um voo em comum novo, e (b) já existia histórico ANTES deste.
    IF v_conn_id IS NOT NULL AND prior_count > 0 THEN
      SELECT COALESCE(NULLIF(btrim(p.name), ''), 'seu colega') INTO partner_name
      FROM public.profiles p WHERE p.user_id = partner.user_id;

      SELECT COALESCE(NULLIF(btrim(p.name), ''), 'seu colega') INTO self_name
      FROM public.profiles p WHERE p.user_id = NEW.user_id;

      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (
        NEW.user_id,
        'Voando com ' || partner_name || ' de novo',
        'Você e ' || partner_name || ' vão voar juntos no voo ' || flight_label ||
          ' — já voaram juntos ' || prior_count ||
          CASE WHEN prior_count = 1 THEN ' vez antes.' ELSE ' vezes antes.' END,
        'info'
      );

      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (
        partner.user_id,
        'Voando com ' || self_name || ' de novo',
        'Você e ' || self_name || ' vão voar juntos no voo ' || flight_label ||
          ' — já voaram juntos ' || prior_count ||
          CASE WHEN prior_count = 1 THEN ' vez antes.' ELSE ' vezes antes.' END,
        'info'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_detect_crew_connections ON public.schedule_entries;
CREATE TRIGGER trg_detect_crew_connections
  AFTER INSERT OR UPDATE ON public.schedule_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_crew_connections();

COMMENT ON FUNCTION public.detect_crew_connections() IS
  'Detecta quando dois usuários do EscalaX têm o mesmo voo (data+número+origem) na escala. '
  'Registra em crew_flight_connections; notifica os dois (tabela notifications) só a partir '
  'da 2ª vez que voarem juntos. SECURITY DEFINER: precisa gravar notificação para outro usuário.';
