
-- Flight Swap Marketplace: Offers
CREATE TABLE public.flight_swap_offers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id uuid NOT NULL,
  schedule_entry_id uuid REFERENCES public.schedule_entries(id) ON DELETE SET NULL,
  flight_number text,
  flight_date text,
  departure_airport text,
  arrival_airport text,
  notes text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.flight_swap_offers ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can see open offers
CREATE POLICY "Anyone can see open offers" ON public.flight_swap_offers
  FOR SELECT TO authenticated USING (status = 'open' OR owner_user_id = auth.uid());

-- Owner manages own offers
CREATE POLICY "Owner manages own offers" ON public.flight_swap_offers
  FOR ALL USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

CREATE TRIGGER update_flight_swap_offers_updated_at
  BEFORE UPDATE ON public.flight_swap_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Flight Swap Marketplace: Proposals
CREATE TABLE public.flight_swap_proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id uuid NOT NULL REFERENCES public.flight_swap_offers(id) ON DELETE CASCADE,
  proposer_user_id uuid NOT NULL,
  proposed_schedule_entry_id uuid REFERENCES public.schedule_entries(id) ON DELETE SET NULL,
  message text,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.flight_swap_proposals ENABLE ROW LEVEL SECURITY;

-- Proposer can see own proposals
CREATE POLICY "Proposer manages own proposals" ON public.flight_swap_proposals
  FOR ALL USING (auth.uid() = proposer_user_id) WITH CHECK (auth.uid() = proposer_user_id);

-- Offer owner can see proposals on their offers
CREATE POLICY "Offer owner can see proposals" ON public.flight_swap_proposals
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.flight_swap_offers WHERE id = offer_id AND owner_user_id = auth.uid())
  );

-- Offer owner can update proposal status (accept/reject)
CREATE POLICY "Offer owner can update proposals" ON public.flight_swap_proposals
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.flight_swap_offers WHERE id = offer_id AND owner_user_id = auth.uid())
  );

CREATE TRIGGER update_flight_swap_proposals_updated_at
  BEFORE UPDATE ON public.flight_swap_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Flight Swap Messages
CREATE TABLE public.flight_swap_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id uuid NOT NULL REFERENCES public.flight_swap_offers(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.flight_swap_messages ENABLE ROW LEVEL SECURITY;

-- Participants of the offer can see messages
CREATE POLICY "Offer participants can see messages" ON public.flight_swap_messages
  FOR SELECT TO authenticated USING (
    sender_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.flight_swap_offers WHERE id = offer_id AND owner_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.flight_swap_proposals WHERE offer_id = flight_swap_messages.offer_id AND proposer_user_id = auth.uid())
  );

CREATE POLICY "Authenticated can send messages" ON public.flight_swap_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_user_id);

-- Feedback Messages
CREATE TABLE public.feedback_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'suggestion',
  subject text,
  message text NOT NULL,
  email text,
  route text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feedback_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own feedback" ON public.feedback_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
