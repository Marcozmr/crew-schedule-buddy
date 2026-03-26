-- Usuários em auth.users sem linha em public.profiles (ex.: criados antes do trigger ou import manual).
-- Idempotente: só insere onde não existe user_id correspondente.

INSERT INTO public.profiles (user_id, name, email, avatar_url)
SELECT
  u.id,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
    ''
  ),
  COALESCE(u.email, ''),
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'avatar_url'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'picture'), ''),
    NULL
  )
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id);
