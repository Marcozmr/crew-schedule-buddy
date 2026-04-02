import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { emitRosterUpdated, subscribeRosterUpdated } from '@/lib/events/roster-events';
import type { DashboardScheduleSourceKind } from '@/lib/roster/dashboard-schedule-consolidation';
import { UserRosterConnectionService } from '@/modules/roster/services/UserRosterConnectionService';
import { applyHomeBaseFromRoster } from '@/lib/services/apply-home-base-from-roster';
import { reportUnexpectedError } from '@/lib/monitoring/errorReporting';

export interface DashboardRosterSourceState {
  rosterId: string | null;
  sourceKind: DashboardScheduleSourceKind;
  sourceLabel: string;
}

export interface ScheduleEntry {
  id: string;
  /** Presente no SELECT * — usado em diagnósticos de dedupe */
  roster_id?: string;
  user_id?: string;
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
  entry_type: string | null;
  crew_status_code: string | null;
  crew_status_label: string | null;
  activity_label: string | null;
}

/** Proteção: nenhuma query de escala deve manter o dashboard em skeleton indefinidamente. */
const SCHEDULE_LOAD_TIMEOUT_MS = 25_000;

export function useScheduleData() {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [dashboardRosterSource, setDashboardRosterSource] = useState<DashboardRosterSourceState | null>(null);
  const [loading, setLoading] = useState(true);
  const prevUserIdRef = useRef<string | null>(null);
  const autoLoadedEmittedRef = useRef(false);

  const loadSchedule = useCallback(async () => {
    if (!user) {
      setSchedule([]);
      setDashboardRosterSource(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    const forceDoneTimer = window.setTimeout(() => {
      setLoading(false);
      if (import.meta.env.DEV) {
        console.warn(
          '[useScheduleData] timeout',
          SCHEDULE_LOAD_TIMEOUT_MS,
          'ms — interrompendo loading (verifique imported_rosters / user_roster_connection / schedule_entries)',
        );
      }
    }, SCHEDULE_LOAD_TIMEOUT_MS);

    try {
      const rosterCtx = await UserRosterConnectionService.resolveDashboardRosterContext(user.id);
      setDashboardRosterSource({
        rosterId: rosterCtx.rosterId,
        sourceKind: rosterCtx.sourceKind,
        sourceLabel: rosterCtx.sourceLabel,
      });

      if (!rosterCtx.rosterId) {
        setSchedule([]);
        if (import.meta.env.DEV) {
          console.info('[useScheduleData] sem roster para o dashboard após consolidação de fontes');
        }
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('schedule_entries') as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('roster_id', rosterCtx.rosterId)
        .order('sort_datetime', { ascending: true, nullsFirst: false });

      if (error && import.meta.env.DEV) {
        console.error('[useScheduleData] schedule_entries SELECT falhou:', error.code, error.message, error.details);
      }
      if (data) setSchedule(data as unknown as ScheduleEntry[]);

      const list = data as ScheduleEntry[] | undefined;
      if (list && list.length > 0 && rosterCtx.rosterId) {
        let rosterExplicitBase: string | null = null;
        const { data: rb } = await supabase
          .from('imported_rosters')
          .select('base_airport')
          .eq('id', rosterCtx.rosterId)
          .maybeSingle();
        rosterExplicitBase = (rb as { base_airport?: string | null } | null)?.base_airport ?? null;

        void applyHomeBaseFromRoster({
          userId: user.id,
          entries: list,
          rosterExplicitBase,
          dashboardSourceKind: rosterCtx.sourceKind,
        });
      }

      if (data && (data as ScheduleEntry[]).length > 0 && !autoLoadedEmittedRef.current) {
        autoLoadedEmittedRef.current = true;
        emitRosterUpdated({
          userId: user.id,
          reason: 'roster_auto_loaded',
          at: new Date().toISOString(),
        });
      }
    } catch (e) {
      reportUnexpectedError(e, { flow: 'schedule_load', extra: { scope: 'dashboard_flight_board' } });
      if (import.meta.env.DEV) {
        console.error('[useScheduleData] loadSchedule erro não tratado (dashboard pode ficar em loading):', e);
      }
    } finally {
      window.clearTimeout(forceDoneTimer);
      setLoading(false);
    }
  }, [user]);

  // Clear schedule when user changes (critical for account switching)
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    if (prevUserIdRef.current !== currentUserId) {
      // User changed — clear stale data immediately
      setSchedule([]);
      setDashboardRosterSource(null);
      setLoading(true);
      prevUserIdRef.current = currentUserId;
      autoLoadedEmittedRef.current = false;
    }
    void loadSchedule();
  }, [loadSchedule, user]);

  useEffect(() => {
    let debounceId: ReturnType<typeof window.setTimeout> | undefined;
    const scheduleReload = () => {
      if (debounceId != null) window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        debounceId = undefined;
        void loadSchedule();
      }, 400);
    };
    const handleFocus = () => scheduleReload();
    const handleVis = () => {
      if (document.visibilityState === 'visible') scheduleReload();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVis);
    return () => {
      if (debounceId != null) window.clearTimeout(debounceId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVis);
    };
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roster_connection', filter: `user_id=eq.${user.id}` },
        () => {
          console.log('[schedule] realtime: user_roster_connection changed; refreshing dashboard');
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

  return { schedule, loading, reload: loadSchedule, dashboardRosterSource };
}
