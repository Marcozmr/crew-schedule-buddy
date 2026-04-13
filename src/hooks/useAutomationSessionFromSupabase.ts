import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AutomationRunRow, AutomationSessionRow } from '@/lib/roster/automation-types';

export function useAutomationSessionFromSupabase(userId: string | undefined, pollMs = 2800) {
  const [session, setSession] = useState<AutomationSessionRow | null>(null);
  const [latestRun, setLatestRun] = useState<AutomationRunRow | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [fetchError, setFetchError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setSession(null);
      setLatestRun(null);
      setLoading(false);
      setFetchError(null);
      return;
    }
    setLoading((v) => v || true);

    const { data: s, error: se } = await supabase
      .from('automation_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'latam')
      .maybeSingle();

    if (se) {
      if (import.meta.env.DEV) {
        console.warn('[useAutomationSessionFromSupabase]', se.message);
      }
      setFetchError(se.message);
      setSession(null);
      setLatestRun(null);
      setLoading(false);
      return;
    }

    setFetchError(null);
    const sess = s as AutomationSessionRow | null;
    setSession(sess);

    if (!sess) {
      setLatestRun(null);
      setLoading(false);
      return;
    }

    const { data: runs, error: re } = await supabase
      .from('automation_runs')
      .select('*')
      .eq('session_id', sess.id)
      .order('started_at', { ascending: false })
      .limit(1);

    if (re) {
      if (import.meta.env.DEV) {
        console.warn('[useAutomationSessionFromSupabase] runs', re.message);
      }
      setLatestRun(null);
    } else {
      setLatestRun(((runs ?? [])[0] as AutomationRunRow | undefined) ?? null);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`automation-user-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'automation_sessions', filter: `user_id=eq.${userId}` },
        () => void refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'automation_runs', filter: `user_id=eq.${userId}` },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  useEffect(() => {
    if (!userId) return;
    const t = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(t);
  }, [userId, pollMs, refresh]);

  return { session, latestRun, loading, fetchError, refresh };
}
