-- REVOKE ... FROM PUBLIC (20260428100000) não alcança anon/authenticated, que recebem
-- EXECUTE direto pelos default privileges do Supabase. Só a Edge Function deve chamar.
REVOKE EXECUTE ON FUNCTION public.keep_alive_ping() FROM anon, authenticated;
