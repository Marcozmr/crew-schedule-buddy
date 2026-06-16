import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { subscribeRosterUpdated } from '@/lib/events/roster-events';
import {
  scheduleFlightNotifications,
  cancelAllFlightNotifications,
} from '@/lib/notifications/flightNotificationService';
import type { ScheduleEntry } from '@/hooks/useScheduleData';

async function fetchUpcomingFlights(userId: string): Promise<ScheduleEntry[]> {
  const today = new Date().toISOString().slice(0, 10);
  const limit = new Date();
  limit.setDate(limit.getDate() + 30);
  const until = limit.toISOString().slice(0, 10);

  const { data } = await supabase
    .from('schedule_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('is_flight', true)
    .gte('date', today)
    .lte('date', until)
    .order('date', { ascending: true })
    .limit(60);

  return (data ?? []) as ScheduleEntry[];
}

/**
 * Hook que mantém notificações locais de voo sincronizadas com a escala.
 * Deve ser montado uma vez no AppLayout (só ativo no Android nativo).
 */
export function useFlightNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return;

    const scheduleForUser = async () => {
      const flights = await fetchUpcomingFlights(user.id);
      await scheduleFlightNotifications(flights);
    };

    // Agenda ao montar (escala já carregada)
    scheduleForUser();

    // Re-agenda sempre que a escala for atualizada
    const unsub = subscribeRosterUpdated(() => {
      scheduleForUser();
    });

    return () => {
      unsub();
    };
  }, [user]);

  // Cancela todas ao deslogar
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!user) {
      cancelAllFlightNotifications();
    }
  }, [user]);
}
