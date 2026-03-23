import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { subscribeRosterUpdated } from '@/lib/events/roster-events';

export interface ScheduleEntry {
  id: string;
  date: string;
  flight_number: string;
  departure: string;
  arrival: string;
  departure_time: string;
  arrival_time: string;
  status: string;
  airline: string | null;
  report_time: string | null;
  duty_hours: number | null;
  flight_hours: number | null;
  activity_type: string;
  is_flight: boolean;
  pairing_code: string | null;
  crew_role: string | null;
  departure_airport: string | null;
  arrival_airport: string | null;
  debrief_time: string | null;
  aircraft_type: string | null;
  hotel_name: string | null;
  raw_line: string | null;
  crosses_midnight: boolean;
  overnight: boolean;
  operation_type: string | null;
  assignment: string | null;
  comments: string | null;
  sort_datetime: string | null;
}

export function useScheduleData() {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const prevUserIdRef = useRef<string | null>(null);

  const loadSchedule = useCallback(async () => {
    if (!user) { setSchedule([]); setLoading(false); return; }
    setLoading(true);

    // Busca todas as escalas ativas para tratar legados com duplicidade
    // e priorizar portal > manual na seleção.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: activeRosters } = await (supabase.from('imported_rosters') as any)
      .select('id, roster_source, created_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(5);

    const selectedActiveRoster = (activeRosters ?? []).sort((a: { roster_source?: string | null }, b: { roster_source?: string | null }) => {
      const pa = a.roster_source === 'portal' ? 0 : 1;
      const pb = b.roster_source === 'portal' ? 0 : 1;
      return pa - pb;
    })[0];

    if (!selectedActiveRoster?.id) {
      setSchedule([]);
      setLoading(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('schedule_entries') as any)
      .select('*')
      .eq('user_id', user.id)
      .eq('roster_id', selectedActiveRoster.id)
      .order('sort_datetime', { ascending: true, nullsFirst: false });

    if (data) setSchedule(data as unknown as ScheduleEntry[]);
    setLoading(false);
  }, [user]);

  // Clear schedule when user changes (critical for account switching)
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    if (prevUserIdRef.current !== currentUserId) {
      // User changed — clear stale data immediately
      setSchedule([]);
      setLoading(true);
      prevUserIdRef.current = currentUserId;
    }
    void loadSchedule();
  }, [loadSchedule, user]);

  useEffect(() => {
    const handleFocus = () => void loadSchedule();
    const handleVis = () => { if (document.visibilityState === 'visible') void loadSchedule(); };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVis);
    return () => { window.removeEventListener('focus', handleFocus); document.removeEventListener('visibilitychange', handleVis); };
  }, [loadSchedule]);

  useEffect(() => {
    if (!user) return;

    // Push update para dashboard e telas consumidoras quando houver mudança de roster.
    const channel = supabase
      .channel(`roster-live:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'imported_rosters', filter: `user_id=eq.${user.id}` },
        () => {
          console.log('[schedule] realtime: imported_rosters changed; refreshing dashboard');
          void loadSchedule();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedule_entries', filter: `user_id=eq.${user.id}` },
        () => {
          console.log('[schedule] realtime: schedule_entries changed; refreshing dashboard');
          void loadSchedule();
        }
      )
      .subscribe();

    const unsubscribeRosterEvent = subscribeRosterUpdated((detail) => {
      if (detail.userId !== user.id) return;
      console.log('[schedule] roster event received; reloading', { reason: detail.reason });
      void loadSchedule();
    });

    return () => {
      unsubscribeRosterEvent();
      void supabase.removeChannel(channel);
    };
  }, [loadSchedule, user]);

  return { schedule, loading, reload: loadSchedule };
}
