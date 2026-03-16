import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';

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

  const loadSchedule = useCallback(async () => {
    if (!user) { setSchedule([]); setLoading(false); return; }
    setLoading(true);

    // Find the active roster
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: activeRoster } = await (supabase.from('imported_rosters') as any)
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!activeRoster) {
      setSchedule([]);
      setLoading(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('schedule_entries') as any)
      .select('*')
      .eq('user_id', user.id)
      .eq('roster_id', activeRoster.id)
      .order('sort_datetime', { ascending: true, nullsFirst: false });

    if (data) setSchedule(data as unknown as ScheduleEntry[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { void loadSchedule(); }, [loadSchedule]);

  useEffect(() => {
    const handleFocus = () => void loadSchedule();
    const handleVis = () => { if (document.visibilityState === 'visible') void loadSchedule(); };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVis);
    return () => { window.removeEventListener('focus', handleFocus); document.removeEventListener('visibilitychange', handleVis); };
  }, [loadSchedule]);

  return { schedule, loading, reload: loadSchedule };
}
