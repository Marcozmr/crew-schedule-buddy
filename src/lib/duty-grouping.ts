/**
 * Duty Period Grouping Engine v4
 *
 * - Agrupa pernas por continuidade real de aeroporto + tempo de conexão plausível
 * - Resolve casos com ordenação inconsistente no roster (ex: trecho madrugada antes do trecho de saída)
 * - Ordena jornadas por início operacional (APR/report_time)
 * - Permite priorização visual por home base no Dashboard
 */

import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { resolveSafeIANATimezone } from '@/lib/date-utils';
import { countsAsOperationalFlightBlockHours } from '@/lib/operational-flight-hours';
import {
  compareScheduleEntries,
  isPresentationEntry,
  operationalSortKey,
} from '@/lib/schedule-entry-sort';

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

function absoluteMinutes(date: string, time: string | null | undefined, refDate: string): number {
  const mins = timeToMinutes(time);
  if (mins < 0) return -1;
  const d = new Date(`${date}T00:00:00`);
  const r = new Date(`${refDate}T00:00:00`);
  const dayOffset = Math.round((d.getTime() - r.getTime()) / 86400000);
  return dayOffset * 1440 + mins;
}

/** Minutos após último block-on (chegada) contados na jornada. */
const POST_BLOCK_DUTY_MIN = 30;

/**
 * Instante local da escala (date + HH:mm). Usado para jornada absoluta com virada de dia.
 */
function parseLocalDateTimeToMs(dateStr: string, time: string | null | undefined): number | null {
  if (!time?.trim()) return null;
  const t = time.trim();
  if (!/^\d{1,2}:\d{2}$/.test(t)) return null;
  const d = new Date(`${dateStr}T${t}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.getTime();
}

/** Quando o roster repete o mesmo `date` em todas as pernas mas a chegada é no dia seguinte, avança até o fim ser ≥ início. */
function advanceEndUntilAfterStartMs(endMs: number, startMs: number): number {
  let t = endMs;
  let guard = 0;
  while (t < startMs && guard++ < 5) {
    t += 86400000;
  }
  return t;
}

function fallbackDutyMinutesFromLegs(legs: ScheduleEntry[]): number {
  const flightsOnly = legs.filter((l) => l.is_flight);
  if (flightsOnly.length === 1 && flightsOnly[0].duty_hours != null && flightsOnly[0].duty_hours > 0) {
    return flightsOnly[0].duty_hours * 60;
  }
  return 0;
}

/**
 * Jornada = apresentação (ou primeiro horário operacional) até fim da sequência:
 * última chegada (block-on), com +30 min pós block-on; se houver debrief depois disso, usa o mais tardio.
 * Trata virada de dia quando `arrival_time` < `report_time` no mesmo `date` ou quando datas estão desalinhadas.
 */
function computeTotalDutyMinutes(legs: ScheduleEntry[]): number {
  const first = legs[0];
  const dutyStartTime = first.report_time || first.departure_time;
  if (!dutyStartTime) {
    return fallbackDutyMinutesFromLegs(legs);
  }

  const startMs = parseLocalDateTimeToMs(first.date, dutyStartTime);
  if (startMs == null) {
    return fallbackDutyMinutesFromLegs(legs);
  }

  const lastFlight = [...legs].reverse().find((l) => l.is_flight);
  const endLeg = lastFlight ?? legs[legs.length - 1];
  const endTime = endLeg.arrival_time ?? endLeg.debrief_time;
  if (!endTime) {
    return fallbackDutyMinutesFromLegs(legs);
  }

  let endMs = parseLocalDateTimeToMs(endLeg.date, endTime);
  if (endMs == null && endLeg.sort_datetime) {
    const p = Date.parse(endLeg.sort_datetime);
    if (!Number.isNaN(p)) endMs = p;
  }
  if (endMs == null) {
    return fallbackDutyMinutesFromLegs(legs);
  }

  endMs = advanceEndUntilAfterStartMs(endMs, startMs);

  if (lastFlight?.debrief_time) {
    const debMsRaw = parseLocalDateTimeToMs(lastFlight.date, lastFlight.debrief_time);
    if (debMsRaw != null) {
      const debMs = advanceEndUntilAfterStartMs(debMsRaw, startMs);
      endMs = Math.max(endMs, debMs);
    }
  }

  const spanMin = (endMs - startMs) / 60000;
  return Math.max(0, spanMin + POST_BLOCK_DUTY_MIN);
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

/**
 * Anexa cada APR ao primeiro grupo (por horário de primeiro voo) do mesmo dia
 * em que o voo ocorre depois da apresentação.
 */
function assignPresentationsToFlightGroups(
  groupsSorted: ScheduleEntry[][],
  presentations: ScheduleEntry[],
): Map<number, ScheduleEntry[]> {
  const map = new Map<number, ScheduleEntry[]>();
  for (const p of [...presentations].sort(compareScheduleEntries)) {
    let bestIdx = -1;
    let bestFirstKey = '';
    for (let i = 0; i < groupsSorted.length; i++) {
      const first = groupsSorted[i][0];
      if (first.date !== p.date) continue;
      if (compareScheduleEntries(p, first) >= 0) continue;
      const fk = operationalSortKey(first);
      if (bestIdx < 0 || fk.localeCompare(bestFirstKey) < 0) {
        bestIdx = i;
        bestFirstKey = fk;
      }
    }
    if (bestIdx >= 0) {
      const arr = map.get(bestIdx) ?? [];
      arr.push(p);
      map.set(bestIdx, arr);
    }
  }
  for (const arr of map.values()) arr.sort(compareScheduleEntries);
  return map;
}

export function groupIntoDutyPeriods(
  entries: ScheduleEntry[],
  gapThresholdMinutes = 600,
): DutyPeriod[] {
  const presentations = entries.filter(isPresentationEntry);
  const flights = entries
    .filter(e => e.is_flight)
    .sort(compareScheduleEntries);

  if (flights.length === 0) {
    const onlyPres = [...presentations].sort(compareScheduleEntries);
    const duties = onlyPres.map(p => buildDutyPeriod([p]));
    duties.sort((a, b) => a.dutyStartAbsoluteMin - b.dutyStartAbsoluteMin);
    return duties;
  }

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

  const groupsSorted = [...groups].sort((a, b) => compareScheduleEntries(a[0], b[0]));
  const prependMap = assignPresentationsToFlightGroups(groupsSorted, presentations);

  const usedPres = new Set<string>();
  prependMap.forEach(arr => arr.forEach(p => usedPres.add(p.id)));

  const augmented: ScheduleEntry[][] = groupsSorted.map((g, i) => {
    const prep = prependMap.get(i) ?? [];
    return [...prep, ...g];
  });

  const standalonePres = presentations
    .filter(p => !usedPres.has(p.id))
    .sort(compareScheduleEntries);

  const duties: DutyPeriod[] = [
    ...augmented.map(legs => buildDutyPeriod(legs)),
    ...standalonePres.map(p => buildDutyPeriod([p])),
  ];
  duties.sort((a, b) => a.dutyStartAbsoluteMin - b.dutyStartAbsoluteMin);
  return duties;
}

// ── Build duty period ──

function buildRouteSummaryFromLegs(legs: ScheduleEntry[]): string {
  const parts: string[] = [];
  for (const leg of legs) {
    const d = normalizeAirport(leg.departure);
    const a = normalizeAirport(leg.arrival);
    if (parts.length === 0 && d) parts.push(d);
    if (a && a !== parts[parts.length - 1]) parts.push(a);
  }
  if (parts.length > 0) return parts.join(' → ');
  return legs.map(l => l.flight_number).join(' · ');
}

/** Horas de bloco por trecho: prioriza horários da escala (evita somar o mesmo valor “oficial” repetido em cada perna). */
export function segmentBlockHoursFromTimes(leg: ScheduleEntry): number | null {
  if (!leg.is_flight) return null;
  const d = timeToMinutes(leg.departure_time);
  const a = timeToMinutes(leg.arrival_time);
  if (d < 0 || a < 0) return null;
  let arr = a;
  if (arr < d) arr += 1440;
  return (arr - d) / 60;
}

function gapBetweenLegs(prev: ScheduleEntry, next: ScheduleEntry): number {
  const g = getConnectionGapMinutes(prev, next, 24 * 60);
  if (g != null) return g;
  const ta = Date.parse(operationalSortKey(prev));
  const tb = Date.parse(operationalSortKey(next));
  if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
  return Math.max(0, Math.round((tb - ta) / 60000));
}

function buildDutyPeriod(legs: ScheduleEntry[]): DutyPeriod {
  const first = legs[0];
  const last = legs[legs.length - 1];
  const lastFlight = [...legs].reverse().find(l => l.is_flight);

  const routeSummary = buildRouteSummaryFromLegs(legs);

  const connectionTimes: number[] = [];
  for (let i = 1; i < legs.length; i++) {
    connectionTimes.push(gapBetweenLegs(legs[i - 1], legs[i]));
  }

  const totalBlockHours = legs
    .filter(l => l.is_flight && countsAsOperationalFlightBlockHours(l))
    .reduce((s, leg) => {
      const fromTimes = segmentBlockHoursFromTimes(leg);
      if (fromTimes != null && Number.isFinite(fromTimes) && fromTimes >= 0) {
        return s + fromTimes;
      }
      if (leg.flight_hours != null && leg.flight_hours > 0) {
        return s + leg.flight_hours;
      }
      return s;
    }, 0);

  const dutyStartTime = first.report_time || first.departure_time;
  const endLeg = lastFlight ?? last;
  const endTime = endLeg.arrival_time;

  const rawDutyMins = computeTotalDutyMinutes(legs);
  const totalDutyHours = Math.round((rawDutyMins / 60) * 100) / 100;

  const crossesMidnight = legs.some(l => l.crosses_midnight)
    || legs.some(l => l.is_flight && didCrossMidnight(l.departure_time, l.arrival_time))
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
    dutyEndTime: endTime,
    dutyStartDate: first.date,
    dutyStartAbsoluteMin,
    legCount: legs.length,
    totalBlockHours,
    totalDutyHours,
    crossesMidnight,
    hasMadrugada,
    connectionTimes,
    debriefTime: lastFlight?.debrief_time ?? last.debrief_time ?? null,
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
      const firstFlight = dp.legs.find(l => l.is_flight);
      const depForBase = firstFlight?.departure ?? dp.legs[0]?.departure;
      const startsFromBase = normalizedBase.length > 0
        && normalizeAirport(depForBase) === normalizedBase;

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
  const tz = resolveSafeIANATimezone(timeZone);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
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
