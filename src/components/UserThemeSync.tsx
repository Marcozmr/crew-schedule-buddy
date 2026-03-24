import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';

const VALID = new Set(['light', 'dark', 'system']);

/**
 * Alinha next-themes com `user_settings.theme` após login (persistência no Supabase).
 */
export function UserThemeSync() {
  const { user } = useAuth();
  const { setTheme } = useTheme();

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    void supabase
      .from('user_settings')
      .select('theme')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data?.theme) return;
        const t = String(data.theme);
        if (VALID.has(t)) setTheme(t);
      });

    return () => {
      cancelled = true;
    };
  }, [user, setTheme]);

  return null;
}
