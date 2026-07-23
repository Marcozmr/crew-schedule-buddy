import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const CHANNEL_ID = 'escalax_roster_reminder';
const PREF_KEY = 'escalax_roster_reminder_notif_id';

/** Id fixo (fora do espaço usado por flightNotificationService, que usa até ~1.9M + offset*1M). */
const REMINDER_ID = 2_000_001;

async function ensurePermission(): Promise<boolean> {
  const { display } = await LocalNotifications.checkPermissions();
  if (display === 'granted') return true;
  const { display: after } = await LocalNotifications.requestPermissions();
  return after === 'granted';
}

async function ensureChannel() {
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'Lembrete de escala EscalaX',
    description: 'Lembra de importar a escala quando o período atual está terminando',
    importance: 3,
    visibility: 1,
    vibration: true,
  }).catch(() => {});
}

export async function cancelRosterSyncReminder() {
  if (!Capacitor.isNativePlatform()) return;
  const scheduled = localStorage.getItem(PREF_KEY);
  if (!scheduled) return;
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] }).catch(() => {});
  localStorage.removeItem(PREF_KEY);
}

/**
 * Agenda um lembrete pra reconectar/importar a escala — compensação por não ser mais 100%
 * automático (login agora acontece no navegador real do usuário, não no servidor).
 * Prioridade: 1 dia antes do fim do período da escala atual (rosterEndDate). Sem essa data (ou
 * já no passado), agenda um lembrete genérico daqui a 7 dias.
 */
export async function scheduleRosterSyncReminder(rosterEndDate: string | null): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const granted = await ensurePermission();
  if (!granted) return;

  await ensureChannel();
  await cancelRosterSyncReminder();

  const now = new Date();
  let at: Date;
  let body: string;

  const endDate = rosterEndDate ? new Date(`${rosterEndDate}T00:00:00`) : null;
  const validEndDate = endDate && !isNaN(endDate.getTime()) ? endDate : null;

  if (validEndDate && validEndDate.getTime() > now.getTime()) {
    at = new Date(validEndDate);
    at.setDate(at.getDate() - 1);
    at.setHours(18, 0, 0, 0);
    if (at.getTime() <= now.getTime()) at = new Date(now.getTime() + 60_000);
    body = 'Sua escala atual termina amanhã — abra o EscalaX e importe o próximo período.';
  } else {
    at = new Date(now);
    at.setDate(at.getDate() + 7);
    body = 'Hora de atualizar sua escala no EscalaX.';
  }

  await LocalNotifications.schedule({
    notifications: [
      {
        id: REMINDER_ID,
        channelId: CHANNEL_ID,
        title: '📋 Atualize sua escala',
        body,
        schedule: { at },
        smallIcon: 'ic_stat_plane',
        actionTypeId: 'OPEN_APP',
      },
    ],
  });
  localStorage.setItem(PREF_KEY, at.toISOString());
}
