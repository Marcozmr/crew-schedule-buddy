import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { resolveSafeIANATimezone } from '@/lib/date-utils';
import { subscribeRosterUpdated } from '@/lib/events/roster-events';
import { OPERATIONAL_PREFERENCES_CHANGED_EVENT } from '@/lib/events/operational-preferences-events';

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
/** Evita skeleton/estado preso se as queries Supabase não retornarem (rede / projeto). */
const LOAD_TIMEOUT_MS = 15_000;

export interface OperationalPreferences {
  homeBase: string | null;
  timezone: string;
  notificationsEnabled: boolean;
  loading: boolean;
  /** Última base inferida (auditoria / UI opcional) */
  detectedBase: string | null;
  /** manual | portal | pdf | manual_text | inferred */
  homeBaseSource: string | null;
  homeBaseUserLocked: boolean;
}

function normalizeBase(base: string | null | undefined): string | null {
  if (!base) return null;
  const normalized = base.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

export function useOperationalPreferences(): OperationalPreferences {
  const { user } = useAuth();
  const [homeBase, setHomeBase] = useState<string | null>(null);
  const [detectedBase, setDetectedBase] = useState<string | null>(null);
  const [homeBaseSource, setHomeBaseSource] = useState<string | null>(null);
  const [homeBaseUserLocked, setHomeBaseUserLocked] = useState(false);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setHomeBase(null);
      setDetectedBase(null);
      setHomeBaseSource(null);
      setHomeBaseUserLocked(false);
      setTimezone(DEFAULT_TIMEZONE);
      setNotificationsEnabled(true);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const raced = await Promise.race([
        Promise.all([
          supabase
            .from('user_settings')
            .select(
              'base_airport, timezone, notifications_enabled, detected_base_airport, home_base_source, home_base_user_locked',
            )
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
        ]),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), LOAD_TIMEOUT_MS)),
      ]);

      if (raced === null) {
        if (import.meta.env.DEV) {
          console.warn(
            '[useOperationalPreferences] timeout',
            LOAD_TIMEOUT_MS,
            'ms — user_settings / imported_rosters; usando defaults',
          );
        }
        setHomeBase(null);
        setDetectedBase(null);
        setHomeBaseSource(null);
        setHomeBaseUserLocked(false);
        setTimezone(DEFAULT_TIMEZONE);
        setNotificationsEnabled(true);
        return;
      }

      const [settingsRes, rosterRes] = raced;

      const settingsBase = normalizeBase(settingsRes.data?.base_airport);
      const rosterBase = normalizeBase(rosterRes.data?.base_airport);
      /** Preferência persistida em user_settings (manual ou detecção aplicada) > cabeçalho do roster ativo */
      setHomeBase(settingsBase ?? rosterBase ?? null);
      setDetectedBase(normalizeBase(settingsRes.data?.detected_base_airport));
      setHomeBaseSource(
        typeof settingsRes.data?.home_base_source === 'string'
          ? settingsRes.data.home_base_source
          : null,
      );
      setHomeBaseUserLocked(Boolean(settingsRes.data?.home_base_user_locked));
      setTimezone(resolveSafeIANATimezone(settingsRes.data?.timezone || DEFAULT_TIMEZONE));
      setNotificationsEnabled(settingsRes.data?.notifications_enabled ?? true);
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error('[useOperationalPreferences] erro ao carregar preferências:', e);
      }
      setHomeBase(null);
      setDetectedBase(null);
      setHomeBaseSource(null);
      setHomeBaseUserLocked(false);
      setTimezone(DEFAULT_TIMEZONE);
      setNotificationsEnabled(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;

    const onPrefs = () => void load();
    window.addEventListener(OPERATIONAL_PREFERENCES_CHANGED_EVENT, onPrefs);

    const unsubRoster = subscribeRosterUpdated((detail) => {
      if (detail.userId === user.id) void load();
    });

    return () => {
      window.removeEventListener(OPERATIONAL_PREFERENCES_CHANGED_EVENT, onPrefs);
      unsubRoster();
    };
  }, [load, user]);

  return {
    homeBase,
    timezone,
    notificationsEnabled,
    loading,
    detectedBase,
    homeBaseSource,
    homeBaseUserLocked,
  };
}
