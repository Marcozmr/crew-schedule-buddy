/**
 * Logs defensivos (somente DEV) para conferir totais de horas e duplicidades aparentes na escala.
 */

import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { segmentBlockHoursFromTimes } from '@/lib/duty-grouping';
import { scheduleEntryNaturalKey } from '@/lib/schedule-entry-dedupe';
import { countsAsOperationalFlightBlockHours, logOperationalFlightHoursDev } from '@/lib/operational-flight-hours';

/** Chamado a partir do dashboard quando a escala muda (apenas import.meta.env.DEV). */
export function logScheduleMetricsDev(schedule: ScheduleEntry[], label = 'dashboard'): void {
  if (!import.meta.env.DEV) return;

  const flights = schedule.filter((e) => e.is_flight);
  let blockFromTimes = 0;
  let blockFromDbOnly = 0;
  for (const e of flights) {
    const t = segmentBlockHoursFromTimes(e);
    if (t != null && t >= 0) blockFromTimes += t;
    else if (e.flight_hours != null && e.flight_hours > 0) blockFromDbOnly += e.flight_hours;
  }

  const byKeyAll = new Map<string, number>();
  for (const e of schedule) {
    const k = scheduleEntryNaturalKey({
      roster_id: e.roster_id,
      user_id: e.user_id,
      date: e.date,
      flight_number: e.flight_number,
      departure_time: e.departure_time,
      arrival_time: e.arrival_time,
      departure: e.departure,
      arrival: e.arrival,
      is_flight: e.is_flight,
      activity_type: e.activity_type,
    });
    byKeyAll.set(k, (byKeyAll.get(k) ?? 0) + 1);
  }
  const dupAll = [...byKeyAll.entries()].filter(([, n]) => n > 1);

  const dutyAll = schedule.filter((e) => e.is_flight);
  console.log(
    `[schedule-metrics:${label}] trechos is_flight=${dutyAll.length} | bloco OP/tripulando=${flights.length} | soma bloco horas voo (horários)=${blockFromTimes.toFixed(2)}h | fallback flight_hours (sem horário)=${blockFromDbOnly.toFixed(2)}h`,
  );
  if (dupAll.length > 0) {
    console.warn(
      `[schedule-metrics:${label}] chaves naturais duplicadas (mesma linha lógica no roster) — ${dupAll.length} grupo(s):`,
      dupAll.slice(0, 12),
    );
  } else {
    console.log(`[schedule-metrics:${label}] dedupe DB: nenhuma chave natural duplicada entre ${schedule.length} linha(s)`);
  }
}
