
-- Add interest_count to flight_swap_offers for "most wanted" ranking
ALTER TABLE public.flight_swap_offers ADD COLUMN IF NOT EXISTS interest_count integer NOT NULL DEFAULT 0;

-- Add index for popular offers query
CREATE INDEX IF NOT EXISTS idx_flight_swap_offers_interest ON public.flight_swap_offers (interest_count DESC, created_at DESC) WHERE status = 'open';
