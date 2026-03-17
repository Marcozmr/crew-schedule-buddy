/**
 * Duty Period Grouping Engine v4
 *
 * - Agrupa pernas por continuidade real de aeroporto + tempo de conexão plausível
 * - Resolve casos com ordenação inconsistente no roster (ex: trecho madrugada antes do trecho de saída)
 * - Ordena jornadas por início operacional (APR/report_time)
 * - Permite priorização visual por home base no Dashboard
 */

import type { ScheduleEntry } from '@/hooks/useScheduleData';

export interface DutyPeriod {
  id: string;
  legs: ScheduleEntry[];
  routeSummary: string;
  reportTime: string | null;
  dutyStartTime: string;
  dutyEndTime: string;
  dutyStartDate: string;
  /** Absolute sort key (minutes from epoch-like reference) for ordering duties */
  dutyStartAbsoluteMin: number;
  legCount: number;
  totalBlockHours: number;
  totalDutyHours: number;
  crossesMidnight: boolean;
  hasMadrugada: boolean;
  connectionTimes: number[];
  debriefTime: string | null;
  homeBasePriority: boolean;
}

// ── Time helpers ──

function timeToMinutes(t: string | null | undefined): number {
  if (!t) return -1;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return -1;
  return h * 60 + m;
}

function isMadrugada(time: string | null | undefined): boolean {
  const mins = timeToMinutes(time);
  return mins >= 0 && mins < 360;
}

function didCrossMidnight(depTime: string, arrTime: string): boolean {
  const d = timeToMinutes(depTime);
  const a = timeToMinutes(arrTime);
  return d >= 0 && a >= 0 && a < d;
}

function normalizeAirport(code: string | null | undefined): string {
  return (code || '').trim().toUpperCase();
}

/** Absolute minutes from a fixed epoch (2020-01-01) for cross-date sorting */
const EPOCH = new Date('2020-01-01T00:00:00').getTime();
function dateTimeToAbsMin(date: string, time: string | null | undefined): number {
  const mins = timeToMinutes(time);
  if (mins < 0) return -1;
  const dayMs = new Date(`${date}T00:00:00`).getTime() - EPOCH;
  return Math.round(dayMs / 60000) + mins;
}

function toDateStartMs(date: string): number {
  return new Date(`${date}T00:00:00`).getTime();
}

function shiftDateStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Prioriza APR/report_time; sort_datetime fica como fallback apenas.
 */
function getEffectiveSortKey(e: ScheduleEntry): string {
  const aprOrDep = e.report_time || e.departure_time || '00:00';
  if (e.date) return `${e.date}T${aprOrDep}`;
  return e.sort_datetime || '';
}

function absoluteMinutes(date: string, time: string | null | undefined, refDate: string): number {
  const mins = timeToMinutes(time);
  if (mins < 0) return -1;
  const d = new Date(`${date}T00:00:00`);
  const r = new Date(`${refDate}T00:00:00`);
  const dayOffset = Math.round((d.getTime() - r.getTime()) / 86400000);
  return dayOffset * 1440 + mins;
}

// ── Chaining validation ──

function getConnectionGapMinutes(
  prevLeg: ScheduleEntry,
  nextLeg: ScheduleEntry,
  maxConnectionMinutes: number,
): number | null {
  // Rule 1: Airport continuity is mandatory
  const prevDest = normalizeAirport(prevLeg.arrival);
  const nextOrig = normalizeAirport(nextLeg.departure);
  if (!prevDest || !nextOrig || prevDest !== nextOrig) return null;

  // Rule 2: Temporal continuity with midnight handling
  const refDate = prevLeg.date;

  let prevArrAbs = absoluteMinutes(prevLeg.date, prevLeg.arrival_time, refDate);
  const prevDepAbs = absoluteMinutes(prevLeg.date, prevLeg.departure_time, refDate);
  if (prevArrAbs >= 0 && prevDepAbs >= 0 && prevArrAbs < prevDepAbs) {
    prevArrAbs += 1440; // previous leg crossed midnight
  }

  let nextDepAbs = absoluteMinutes(nextLeg.date, nextLeg.departure_time, refDate);
  if (nextDepAbs < 0 || prevArrAbs < 0) return null;

  if (nextDepAbs < prevArrAbs) {
    const dayDiff = Math.round((toDateStartMs(nextLeg.date) - toDateStartMs(prevLeg.date)) / 86400000);
    if (dayDiff === 0 || dayDiff === 1) {
      nextDepAbs += 1440;
    }
  }

  const gap = nextDepAbs - prevArrAbs;
  if (gap < 0 || gap >= maxConnectionMinutes) return null;

  return gap;
}

function canChainLegs(
  prevLeg: ScheduleEntry,
  nextLeg: ScheduleEntry,
  maxConnectionMinutes: number,
): boolean {
  return getConnectionGapMinutes(prevLeg, nextLeg, maxConnectionMinutes) !== null;
}

function findBestBackwardCandidateIndex(
  pool: ScheduleEntry[],
  firstLeg: ScheduleEntry,
  maxConnectionMinutes: number,
): number {
  let selectedIdx = -1;
  let bestGap = Number.POSITIVE_INFINITY;

  for (let i = 0; i < pool.length; i++) {
    const gap = getConnectionGapMinutes(pool[i], firstLeg, maxConnectionMinutes);
    if (gap == null) continue;

    if (gap < bestGap) {
      bestGap = gap;
      selectedIdx = i;
    }
  }

  return selectedIdx;
}

function findBestForwardCandidateIndex(
  pool: ScheduleEntry[],
  lastLeg: ScheduleEntry,
  maxConnectionMinutes: number,
): number {
  let selectedIdx = -1;
  let bestGap = Number.POSITIVE_INFINITY;

  for (let i = 0; i < pool.length; i++) {
    const gap = getConnectionGapMinutes(lastLeg, pool[i], maxConnectionMinutes);
    if (gap == null) continue;

    if (gap < bestGap) {
      bestGap = gap;
      selectedIdx = i;
    }
  }

  return selectedIdx;
}

// ── Main grouping ──

export function groupIntoDutyPeriods(
  entries: ScheduleEntry[],
  gapThresholdMinutes = 600,
): DutyPeriod[] {
  const flights = entries
    .filter(e => e.is_flight)
    .sort((a, b) => getEffectiveSortKey(a).localeCompare(getEffectiveSortKey(b)));

  if (flights.length === 0) return [];

  // Build groups by expanding both directions to recover correct operational sequence
  // even when input order is inconsistent around midnight.
  const pool = [...flights];
  const groups: ScheduleEntry[][] = [];

  while (pool.length > 0) {
    const seed = pool.shift()!;
    const group: ScheduleEntry[] = [seed];

    let expanded = true;
    while (expanded) {
      expanded = false;

      const backwardIdx = findBestBackwardCandidateIndex(pool, group[0], gapThresholdMinutes);
      if (backwardIdx >= 0) {
        group.unshift(pool.splice(backwardIdx, 1)[0]);
        expanded = true;
      }

      const forwardIdx = findBestForwardCandidateIndex(pool, group[group.length - 1], gapThresholdMinutes);
      if (forwardIdx >= 0) {
        group.push(pool.splice(forwardIdx, 1)[0]);
        expanded = true;
      }
    }

    groups.push(group);
  }

  // Build duty periods and sort by absolute start time
  const duties = groups.map(legs => buildDutyPeriod(legs));
  duties.sort((a, b) => a.dutyStartAbsoluteMin - b.dutyStartAbsoluteMin);
  return duties;
}

// ── Build duty period ──

function buildDutyPeriod(legs: ScheduleEntry[]): DutyPeriod {
  const first = legs[0];
  const last = legs[legs.length - 1];

  const airports: string[] = [first.departure];
  for (const leg of legs) airports.push(leg.arrival);
  const routeSummary = airports.join(' → ');

  const connectionTimes: number[] = [];
  for (let i = 1; i < legs.length; i++) {
    const gap = getConnectionGapMinutes(legs[i - 1], legs[i], 24 * 60);
    connectionTimes.push(gap ?? 0);
  }

  const totalBlockHours = legs.reduce((s, l) => s + (l.flight_hours || 0), 0);

  const dutyStartTime = first.report_time || first.departure_time;
  const reportMin = timeToMinutes(dutyStartTime);
  let lastArrMin = timeToMinutes(last.arrival_time);
  if (reportMin >= 0 && lastArrMin >= 0 && lastArrMin < reportMin) {
    lastArrMin += 1440;
  }
  const rawDutyMins = (reportMin >= 0 && lastArrMin >= 0)
    ? (lastArrMin - reportMin + 30)
    : legs.reduce((s, l) => s + (l.duty_hours || 0) * 60, 0);
  const totalDutyHours = Math.round((rawDutyMins / 60) * 100) / 100;

  const crossesMidnight = legs.some(l => l.crosses_midnight)
    || legs.some(l => didCrossMidnight(l.departure_time, l.arrival_time))
    || (first.date !== last.date);

  const hasMadrugada = legs.some(l =>
    isMadrugada(l.departure_time) || isMadrugada(l.arrival_time),
  );

  const dutyStartAbsoluteMin = dateTimeToAbsMin(first.date, dutyStartTime);

  return {
    id: first.id,
    legs,
    routeSummary,
    reportTime: first.report_time || null,
    dutyStartTime,
    dutyEndTime: last.arrival_time,
    dutyStartDate: first.date,
    dutyStartAbsoluteMin,
    legCount: legs.length,
    totalBlockHours,
    totalDutyHours,
    crossesMidnight,
    hasMadrugada,
    connectionTimes,
    debriefTime: last.debrief_time || null,
    homeBasePriority: false,
  };
}

// ── Query helpers ──

export function getTodayDutyPeriods(
  dutyPeriods: DutyPeriod[],
  todayStr: string,
  homeBase?: string | null,
): DutyPeriod[] {
  const yesterdayStr = shiftDateStr(todayStr, -1);
  const normalizedBase = normalizeAirport(homeBase);

  const result = dutyPeriods
    .filter(dp => {
      if (dp.legs.some(l => l.date === todayStr)) return true;
      if (dp.dutyStartDate === yesterdayStr && dp.crossesMidnight) return true;
      return false;
    })
    .map(dp => {
      const startsFromBase = normalizedBase.length > 0
        && normalizeAirport(dp.legs[0]?.departure) === normalizedBase;

      return {
        ...dp,
        homeBasePriority: startsFromBase,
      };
    });

  // Visual priority in Dashboard:
  // 1) Journeys starting from home base
  // 2) Operational start (APR/duty start)
  result.sort((a, b) => {
    const baseDiff = Number(b.homeBasePriority) - Number(a.homeBasePriority);
    if (baseDiff !== 0) return baseDiff;
    return a.dutyStartAbsoluteMin - b.dutyStartAbsoluteMin;
  });

  return result;
}

function getTimeInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find(p => p.type === 'hour')?.value ?? '00';
  const minute = parts.find(p => p.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

export function getNextDutyPeriod(
  dutyPeriods: DutyPeriod[],
  todayStr: string,
  now: Date = new Date(),
  timeZone = 'America/Sao_Paulo',
): DutyPeriod | null {
  const nowAbsMin = dateTimeToAbsMin(todayStr, getTimeInTimeZone(now, timeZone));

  const upcoming = dutyPeriods
    .filter(dp => dp.dutyStartAbsoluteMin > nowAbsMin)
    .sort((a, b) => a.dutyStartAbsoluteMin - b.dutyStartAbsoluteMin);

  return upcoming[0] || null;
}

export function formatDutyTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}
