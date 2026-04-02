-- Reforço idempotente: garantir UNIQUE em profiles.user_id (pode já existir de migrações anteriores).
-- Sem dados destrutivos; apenas adiciona a constraint se ainda não existir.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;
