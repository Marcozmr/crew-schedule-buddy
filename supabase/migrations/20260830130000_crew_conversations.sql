-- Chat entre usuários que vão voar juntos de novo.
-- Modelo: automático — a conversa é criada pelo mesmo trigger que já detecta voos em comum
-- (detect_crew_connections), assim que dois usuários voarem juntos pela 2ª vez. Não há pedido
-- de contato: só é possível conversar com quem você realmente compartilha voo.

CREATE TABLE IF NOT EXISTS public.crew_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- user_a_id sempre o menor UUID, user_b_id o maior — um par, uma conversa contínua.
  user_a_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  CONSTRAINT crew_conversations_user_order CHECK (user_a_id < user_b_id),
  CONSTRAINT crew_conversations_unique_pair UNIQUE (user_a_id, user_b_id)
);

COMMENT ON TABLE public.crew_conversations IS
  'Uma conversa por par de usuários que já voaram juntos mais de uma vez. Criada só pelo trigger detect_crew_connections (SECURITY DEFINER) — sem insert direto do cliente.';

ALTER TABLE public.crew_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversations"
ON public.crew_conversations
FOR SELECT
USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE INDEX IF NOT EXISTS idx_crew_conversations_user_a ON public.crew_conversations (user_a_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_crew_conversations_user_b ON public.crew_conversations (user_b_id, last_message_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.crew_conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.crew_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (btrim(message) <> '' AND char_length(message) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crew_conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view conversation messages"
ON public.crew_conversation_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.crew_conversations c
    WHERE c.id = conversation_id AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
  )
);

CREATE POLICY "Participants can send conversation messages"
ON public.crew_conversation_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.crew_conversations c
    WHERE c.id = conversation_id AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
  )
);

CREATE INDEX IF NOT EXISTS idx_crew_conversation_messages_conversation
  ON public.crew_conversation_messages (conversation_id, created_at);

-- Realtime: chat ao vivo na UI.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'crew_conversation_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crew_conversation_messages;
  END IF;
END $$;

-- Atualiza last_message_at da conversa + notifica o destinatário a cada mensagem nova.
CREATE OR REPLACE FUNCTION public.on_crew_conversation_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv RECORD;
  recipient_id uuid;
  sender_name text;
BEGIN
  SELECT * INTO conv FROM public.crew_conversations WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE public.crew_conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;

  recipient_id := CASE WHEN conv.user_a_id = NEW.sender_id THEN conv.user_b_id ELSE conv.user_a_id END;

  SELECT COALESCE(NULLIF(btrim(p.name), ''), 'Um colega') INTO sender_name
  FROM public.profiles p WHERE p.user_id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    recipient_id,
    'Nova mensagem de ' || sender_name,
    left(NEW.message, 140),
    'info'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_crew_conversation_message ON public.crew_conversation_messages;
CREATE TRIGGER trg_on_crew_conversation_message
  AFTER INSERT ON public.crew_conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.on_crew_conversation_message();

-- detect_crew_connections passa a também garantir que a conversa existe quando notifica
-- (ou seja, a partir da 2ª vez que dois usuários voarem juntos).
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
  IF NEW.flight_number IS NULL OR btrim(NEW.flight_number) = '' THEN
    RETURN NEW;
  END IF;
  IF NEW.entry_type IS NOT NULL AND NEW.entry_type <> 'flight' THEN
    RETURN NEW;
  END IF;

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

    IF v_conn_id IS NOT NULL AND prior_count > 0 THEN
      -- Garante a conversa (idempotente) a partir do momento em que passam a ter histórico.
      INSERT INTO public.crew_conversations (user_a_id, user_b_id)
      VALUES (ua, ub)
      ON CONFLICT (user_a_id, user_b_id) DO NOTHING;

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

COMMENT ON FUNCTION public.detect_crew_connections() IS
  'Detecta quando dois usuários do EscalaX têm o mesmo voo (data+número+origem) na escala. '
  'Registra em crew_flight_connections; a partir da 2ª vez que voarem juntos, notifica os dois '
  'e garante uma crew_conversations entre eles. SECURITY DEFINER: precisa gravar para outro usuário.';
