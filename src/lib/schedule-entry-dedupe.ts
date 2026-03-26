/**
 * Chave natural alinhada à migration `schedule_entries_natural_leg_uniq`:
 * (roster_id, user_id, date, voo, horários, aeroportos, is_flight, activity_type).
 */

export type ScheduleEntryNaturalKeyInput = {
  roster_id?: string | null;
  user_id?: string | null;
  date: string;
  flight_number: string;
  departure_time: string;
  arrival_time: string;
  departure: string;
  arrival: string;
  is_flight: boolean;
  activity_type: string;
};

/** Primeiros 5 caracteres após trim — alinhado a `left(btrim(...), 5)` no Postgres. */
export function normalizeTimeHead5(t: string | null | undefined): string {
  return String(t ?? '00:00').trim().slice(0, 5);
}

export function scheduleEntryNaturalKey(row: ScheduleEntryNaturalKeyInput): string {
  return [
    row.roster_id ?? '',
    row.user_id ?? '',
    row.date,
    (row.flight_number || '').trim().toUpperCase(),
    normalizeTimeHead5(row.departure_time),
    normalizeTimeHead5(row.arrival_time),
    (row.departure || '').trim().toUpperCase(),
    (row.arrival || '').trim().toUpperCase(),
    row.is_flight ? 't' : 'f',
    row.activity_type || '',
  ].join('|');
}

export function dedupeScheduleEntryRows<T extends ScheduleEntryNaturalKeyInput>(
  rows: T[]
): { rows: T[]; removed: number } {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const k = scheduleEntryNaturalKey(row);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }
  return { rows: out, removed: rows.length - out.length };
}
