import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { ScheduleEntry } from '@/hooks/useScheduleData';

const CHANNEL_ID = 'escalax_flights';
const PREF_KEY = 'escalax_scheduled_notif_ids';

function loadScheduledIds(): number[] {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) ?? '[]'); } catch { return []; }
}
function saveScheduledIds(ids: number[]) {
  localStorage.setItem(PREF_KEY, JSON.stringify(ids));
}

function stableId(entry: ScheduleEntry, offset = 0): number {
  const str = `${entry.date}|${entry.flight_number}|${offset}`;
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1_900_000) + offset * 1_000_000;
}

async function ensurePermission(): Promise<boolean> {
  const { display } = await LocalNotifications.checkPermissions();
  if (display === 'granted') return true;
  const { display: after } = await LocalNotifications.requestPermissions();
  return after === 'granted';
}

async function ensureChannel() {
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'Voos EscalaX',
    description: 'Lembretes de apresentação e horário de voo',
    importance: 4,
    visibility: 1,
    vibration: true,
  }).catch(() => {});
}

export async function cancelAllFlightNotifications() {
  if (!Capacitor.isNativePlatform()) return;
  const ids = loadScheduledIds();
  if (ids.length === 0) return;
  await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) }).catch(() => {});
  saveScheduledIds([]);
}

/**
 * Agenda notificações para os próximos voos da escala.
 * Para cada voo agenda:
 * - 06:00 do dia do voo (lembrete matinal)
 * - 1h antes da apresentação (reportTime) ou 1h30 antes da partida
 */
export async function scheduleFlightNotifications(entries: ScheduleEntry[]) {
  if (!Capacitor.isNativePlatform()) return;

  const granted = await ensurePermission();
  if (!granted) {
    console.warn('[FlightNotifications] permissão negada');
    return;
  }

  await ensureChannel();
  await cancelAllFlightNotifications();

  const now = Date.now();
  const notifications: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = [];
  const ids: number[] = [];

  const flights = entries.filter(e => e.is_flight && e.status !== 'cancelled');

  for (const entry of flights) {
    const parts = (entry.date ?? '').split('-').map(Number);
    if (parts.length < 3 || !parts[0]) continue;
    const [yr, mo, dy] = parts;

    const depParts = (entry.departure_time ?? '').split(':').map(Number);
    const hasDepTime = depParts.length >= 2 && !isNaN(depParts[0]);

    // --- Lembrete matinal às 06:00 ---
    const morning = new Date(yr, mo - 1, dy, 6, 0, 0);
    if (morning.getTime() > now) {
      const id = stableId(entry, 0);
      notifications.push({
        id,
        channelId: CHANNEL_ID,
        title: `✈️ Voo hoje — ${entry.flight_number}`,
        body: `${entry.departure} → ${entry.arrival}${hasDepTime ? ` às ${entry.departure_time}` : ''}`,
        schedule: { at: morning },
        smallIcon: 'ic_stat_plane',
        actionTypeId: 'OPEN_APP',
      });
      ids.push(id);
    }

    // --- Lembrete pré-apresentação ---
    if (hasDepTime) {
      let alertAt: Date;
      const report = entry.report_time;

      if (report) {
        const [rh, rm] = report.split(':').map(Number);
        // 60 min antes da apresentação
        alertAt = new Date(yr, mo - 1, dy, rh, rm, 0);
        alertAt.setMinutes(alertAt.getMinutes() - 60);
      } else {
        // 90 min antes da partida
        alertAt = new Date(yr, mo - 1, dy, depParts[0], depParts[1], 0);
        alertAt.setMinutes(alertAt.getMinutes() - 90);
      }

      if (alertAt.getTime() > now) {
        const id = stableId(entry, 1);
        notifications.push({
          id,
          channelId: CHANNEL_ID,
          title: `🛫 Apresentação em 1h — ${entry.flight_number}`,
          body: report
            ? `${entry.departure} → ${entry.arrival} | Apresentação: ${report}`
            : `${entry.departure} → ${entry.arrival} | Partida: ${entry.departure_time}`,
          schedule: { at: alertAt },
          smallIcon: 'ic_stat_plane',
          actionTypeId: 'OPEN_APP',
        });
        ids.push(id);
      }
    }
  }

  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
    saveScheduledIds(ids);
    console.info(`[FlightNotifications] ${notifications.length} notificações agendadas`);
  }
}
