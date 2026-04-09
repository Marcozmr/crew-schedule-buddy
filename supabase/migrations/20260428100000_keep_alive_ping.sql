-- Ping mínimo para a Edge Function `keep-alive` (apenas service_role via função Edge).
-- Não expor a anon/authenticated: evita abuso direto da API pública.

CREATE OR REPLACE FUNCTION public.keep_alive_ping()
RETURNS timestamptz
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT now();
$$;

REVOKE ALL ON FUNCTION public.keep_alive_ping() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.keep_alive_ping() TO service_role;

COMMENT ON FUNCTION public.keep_alive_ping() IS
  'Chamada apenas pela Edge Function keep-alive (service_role). Mantém atividade mínima no projeto.';
