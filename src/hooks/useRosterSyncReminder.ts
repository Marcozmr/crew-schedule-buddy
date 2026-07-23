import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/lib/auth-context';
import { useUserRosterConnection } from '@/hooks/useUserRosterConnection';
import { subscribeRosterUpdated } from '@/lib/events/roster-events';
import {
  scheduleRosterSyncReminder,
  cancelRosterSyncReminder,
} from '@/lib/notifications/rosterSyncReminderService';

/**
 * Mantém um lembrete local de sincronização da escala — compensa o login/importação deixarem
 * de ser 100% automáticos (agora acontecem no navegador real do usuário). Deve ser montado uma
 * vez no AppLayout, ao lado de useFlightNotifications (só ativo no app nativo).
 */
export function useRosterSyncReminder() {
  const { user } = useAuth();
  const { activeRosterMeta, refresh } = useUserRosterConnection();

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return;
    void scheduleRosterSyncReminder(activeRosterMeta?.roster_end_date ?? null);
  }, [user, activeRosterMeta?.roster_end_date]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return;
    return subscribeRosterUpdated(() => {
      void refresh();
    });
  }, [user, refresh]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!user) {
      void cancelRosterSyncReminder();
    }
  }, [user]);
}
