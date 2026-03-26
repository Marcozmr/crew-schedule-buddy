import { useCallback, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import {
  applyResolvedThemePreference,
  normalizeThemePreference,
} from '@/lib/themeByTime';
import { OPERATIONAL_PREFERENCES_CHANGED_EVENT } from '@/lib/events/operational-preferences-events';

/**
 * Sincroniza next-themes com `user_settings.theme` + `timezone`.
 * Preferência `auto`: claro/escuro pelo horário no fuso salvo (ou do navegador).
 */
export function UserThemeSync() {
  const { user } = useAuth();
  const { setTheme } = useTheme();

  const syncFromServer = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_settings')
      .select('theme, timezone')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!data) return;
    const pref = normalizeThemePreference(data.theme);
    applyResolvedThemePreference(pref, data.timezone, setTheme);
  }, [user, setTheme]);

  useEffect(() => {
    void syncFromServer();
  }, [syncFromServer]);

  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(() => void syncFromServer(), 60_000);
    const onPrefs = () => void syncFromServer();
    window.addEventListener(OPERATIONAL_PREFERENCES_CHANGED_EVENT, onPrefs);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(OPERATIONAL_PREFERENCES_CHANGED_EVENT, onPrefs);
    };
  }, [user, syncFromServer]);

  return null;
}
