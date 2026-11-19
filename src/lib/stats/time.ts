/**
 * Horários da escala são locais da estação. Aqui viram instantes UTC (pelo fuso de cada aeroporto)
 * para medir duração real e separar horas diurnas (06h–18h) e noturnas (18h–06h) no fuso da base.
 */
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { airportTz } from '@/lib/airports';

const MINUTE = 60_000;
const DAY = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Diferença entre a hora local no fuso e o UTC, em ms, no instante dado. */
function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = Object.fromEntries(formatterFor(tz).formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return asUtc - Math.floor(utcMs / MINUTE) * MINUTE;
}

function parseHhmm(hhmm: string): [number, number] | null {
  const m = String(hhmm ?? '').match(/^(\d{1,2}):(\d{2})/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** "2026-03-12" + "17:00" no fuso dado → instante UTC em ms. */
export function localToUtcMs(date: string, hhmm: string, tz: string): number {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = parseHhmm(hhmm) ?? [0, 0];
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let utc = wall - tzOffsetMs(wall, tz);
  utc = wall - tzOffsetMs(utc, tz);
  return utc;
}

function addDays(date: string, days: number): string {
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d + days)).toISOString().slice(0, 10);
}

/** Início e fim do voo em UTC; `null` se faltar horário ou se algum aeroporto não estiver na tabela. */
export function legUtcRange(e: ScheduleEntry): { start: number; end: number } | null {
  const depTz = airportTz(e.departure_airport || e.departure);
  const arrTz = airportTz(e.arrival_airport || e.arrival);
  if (!depTz || !arrTz || !parseHhmm(e.departure_time) || !parseHhmm(e.arrival_time)) return null;
  const start = localToUtcMs(e.date, e.departure_time, depTz);
  let end = localToUtcMs(addDays(e.date, e.crosses_midnight ? 1 : 0), e.arrival_time, arrTz);
  if (end < start) end += DAY;
  return { start, end };
}

/** Minutos diurnos (06h–18h) e noturnos (18h–06h) do intervalo, na hora local do fuso dado. */
export function splitDayNightMinutes(startUtc: number, endUtc: number, tz: string): { day: number; night: number } {
  const offset = tzOffsetMs(startUtc, tz);
  let t = startUtc + offset;
  const end = endUtc + offset;
  let day = 0;
  let night = 0;
  while (t < end) {
    const dayStart = Math.floor(t / DAY) * DAY;
    const next = [dayStart + 6 * 3_600_000, dayStart + 18 * 3_600_000, dayStart + DAY].find((b) => b > t)!;
    const segEnd = Math.min(next, end);
    const hour = (t - dayStart) / 3_600_000;
    if (hour >= 6 && hour < 18) day += segEnd - t;
    else night += segEnd - t;
    t = segEnd;
  }
  return { day: Math.round(day / MINUTE), night: Math.round(night / MINUTE) };
}
