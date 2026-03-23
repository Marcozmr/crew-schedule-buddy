import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { resolveSafeIANATimezone } from '@/lib/date-utils';

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export interface OperationalPreferences {
  homeBase: string | null;
  timezone: string;
  notificationsEnabled: boolean;
  loading: boolean;
}

function normalizeBase(base: string | null | undefined): string | null {
  if (!base) return null;
  const normalized = base.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

export function useOperationalPreferences(): OperationalPreferences {
  const { user } = useAuth();
  const [homeBase, setHomeBase] = useState<string | null>(null);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setHomeBase(null);
      setTimezone(DEFAULT_TIMEZONE);
      setNotificationsEnabled(true);
      setLoading(false);
      return;
    }

    let mounted = true;

    const load = async () => {
      setLoading(true);

      const [settingsRes, rosterRes] = await Promise.all([
        supabase
          .from('user_settings')
          .select('base_airport, timezone, notifications_enabled')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('imported_rosters')
          .select('base_airport')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (!mounted) return;

      const settingsBase = normalizeBase(settingsRes.data?.base_airport);
      const rosterBase = normalizeBase(rosterRes.data?.base_airport);

      setHomeBase(rosterBase ?? settingsBase ?? null);
      setTimezone(resolveSafeIANATimezone(settingsRes.data?.timezone || DEFAULT_TIMEZONE));
      setNotificationsEnabled(settingsRes.data?.notifications_enabled ?? true);
      setLoading(false);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [user]);

  return { homeBase, timezone, notificationsEnabled, loading };
}
