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
}

export function useScheduleData() {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSchedule = useCallback(async () => {
    if (!user) {
      setSchedule([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data } = await supabase
      .from('schedule_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true });

    if (data) setSchedule(data as ScheduleEntry[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  // Reload on focus/visibility
  useEffect(() => {
    const handleFocus = () => void loadSchedule();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void loadSchedule();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadSchedule]);

  return { schedule, loading, reload: loadSchedule };
}
