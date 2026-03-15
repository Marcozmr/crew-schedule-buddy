CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = CASE WHEN profiles.name = '' OR profiles.name IS NULL 
           THEN COALESCE(EXCLUDED.name, profiles.name) 
           ELSE profiles.name END,
    avatar_url = CASE WHEN profiles.avatar_url IS NULL 
                 THEN EXCLUDED.avatar_url 
                 ELSE profiles.avatar_url END,
    updated_at = now();
  RETURN NEW;
END;
$function$;