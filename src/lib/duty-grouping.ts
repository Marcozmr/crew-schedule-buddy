/**
 * Duty Period Grouping Engine v2
 * 
 * Groups flight legs into operational duty periods with:
 * - Airport continuity validation (prev.arrival === next.departure)
 * - Ordering by presentation time (APR) not just departure
 * - Correct midnight-crossing handling
 * - Home base priority for visual ordering
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
  legCount: number;
  totalBlockHours: number;
  totalDutyHours: number;
  crossesMidnight: boolean;
  hasMadrugada: boolean;
  connectionTimes: number[];
  debriefTime: string | null;
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

/**
 * Effective sort key: sort_datetime > date+report_time > date+departure_time.
 * This ensures ordering by presentation (APR) when available.
 */
function getEffectiveSortKey(e: ScheduleEntry): string {
  if (e.sort_datetime) return e.sort_datetime;
  const time = e.report_time || e.departure_time || '00:00';
  return `${e.date}T${time}`;
}

/**
 * Get the "absolute minutes" of a leg's time, accounting for date offset from a reference date.
 * This makes cross-midnight comparisons trivial.
 */
function absoluteMinutes(date: string, time: string | null | undefined, refDate: string): number {
  const mins = timeToMinutes(time);
  if (mins < 0) return -1;
  const d = new Date(date + 'T00:00:00');
  const r = new Date(refDate + 'T00:00:00');
  const dayOffset = Math.round((d.getTime() - r.getTime()) / 86400000);
  return dayOffset * 1440 + mins;
}

// ── Chaining validation ──

/**
 * Determines if nextLeg can be chained to prevLeg as part of the same duty.
 * 
 * Rules:
 * 1. Airport continuity: prevLeg.arrival === nextLeg.departure (IATA codes)
 * 2. Temporal order: next departure >= prev arrival (with midnight adjustment)
 * 3. Connection time < threshold (default 10h)
 */
function canChainLegs(
  prevLeg: ScheduleEntry,
  nextLeg: ScheduleEntry,
  maxConnectionMinutes: number
): boolean {
  // Rule 1: Airport continuity — departure of next must match arrival of previous
  const prevDest = (prevLeg.arrival || '').toUpperCase().trim();
  const nextOrig = (nextLeg.departure || '').toUpperCase().trim();
  if (!prevDest || !nextOrig || prevDest !== nextOrig) {
    return false;
  }

  // Rule 2 & 3: Temporal — compute gap
  const refDate = prevLeg.date; // use first leg's date as reference
  let prevArrAbs = absoluteMinutes(prevLeg.date, prevLeg.arrival_time, refDate);
  const prevDepAbs = absoluteMinutes(prevLeg.date, prevLeg.departure_time, refDate);
  
  // If arrival < departure on same date, leg crossed midnight → add 1440
  if (prevArrAbs >= 0 && prevDepAbs >= 0 && prevArrAbs < prevDepAbs) {
    prevArrAbs += 1440;
  }

  let nextDepAbs = absoluteMinutes(nextLeg.date, nextLeg.departure_time, refDate);
  // If next is on a later date, absoluteMinutes already accounts for it
  // But if next dep < prev arr within same date offset, next crossed midnight
  if (nextDepAbs >= 0 && prevArrAbs >= 0 && nextDepAbs < prevArrAbs) {
    // Could be next day — only add if dates suggest it
    const dayDiff = Math.round(
      (new Date(nextLeg.date + 'T00:00:00').getTime() - new Date(prevLeg.date + 'T00:00:00').getTime()) / 86400000
    );
    if (dayDiff === 0) {
      // Same calendar date but next dep < prev arr → next is actually next day
      nextDepAbs += 1440;
    }
  }

  if (prevArrAbs < 0 || nextDepAbs < 0) return false;

  const gap = nextDepAbs - prevArrAbs;
  // Gap must be non-negative (temporal order) and within threshold
  return gap >= 0 && gap < maxConnectionMinutes;
}

// ── Main grouping ──

export function groupIntoDutyPeriods(
  entries: ScheduleEntry[],
  gapThresholdMinutes = 600
): DutyPeriod[] {
  const flights = entries
    .filter(e => e.is_flight)
    .sort((a, b) => getEffectiveSortKey(a).localeCompare(getEffectiveSortKey(b)));

  if (flights.length === 0) return [];

  const groups: ScheduleEntry[][] = [];
  let currentGroup: ScheduleEntry[] = [flights[0]];

  for (let i = 1; i < flights.length; i++) {
    const prev = currentGroup[currentGroup.length - 1];
    const curr = flights[i];

    if (canChainLegs(prev, curr, gapThresholdMinutes)) {
      currentGroup.push(curr);
    } else {
      groups.push(currentGroup);
      currentGroup = [curr];
    }
  }
  groups.push(currentGroup);

  return groups.map(legs => buildDutyPeriod(legs));
}

// ── Build duty period ──

function buildDutyPeriod(legs: ScheduleEntry[]): DutyPeriod {
  const first = legs[0];
  const last = legs[legs.length - 1];

  // Route: BSB → JPA → GRU
  const airports: string[] = [first.departure];
  for (const leg of legs) airports.push(leg.arrival);
  const routeSummary = airports.join(' → ');

  // Connection times between legs
  const connectionTimes: number[] = [];
  for (let i = 1; i < legs.length; i++) {
    const prevArr = timeToMinutes(legs[i - 1].arrival_time);
    const currDep = timeToMinutes(legs[i].departure_time);
    if (prevArr >= 0 && currDep >= 0) {
      let conn = currDep - prevArr;
      if (conn < 0) conn += 1440;
      connectionTimes.push(conn);
    } else {
      connectionTimes.push(0);
    }
  }

  const totalBlockHours = legs.reduce((s, l) => s + (l.flight_hours || 0), 0);

  // Duty hours: report → last arrival + 30min debrief
  const reportMin = timeToMinutes(first.report_time || first.departure_time);
  let lastArrMin = timeToMinutes(last.arrival_time);
  if (reportMin >= 0 && lastArrMin >= 0 && lastArrMin < reportMin) {
    lastArrMin += 1440;
  }
  const rawDutyMins = (reportMin >= 0 && lastArrMin >= 0)
    ? (lastArrMin - reportMin + 30)
    : legs.reduce((s, l) => s + (l.duty_hours || 0) * 60, 0);
  const totalDutyHours = Math.round((rawDutyMins / 60) * 100) / 100;

  const crossesMidnight = legs.some(l => l.crosses_midnight) ||
    legs.some(l => didCrossMidnight(l.departure_time, l.arrival_time)) ||
    (first.date !== last.date);

  const hasMadrugada = legs.some(l =>
    isMadrugada(l.departure_time) || isMadrugada(l.arrival_time)
  );

  return {
    id: first.id,
    legs,
    routeSummary,
    reportTime: first.report_time || null,
    dutyStartTime: first.report_time || first.departure_time,
    dutyEndTime: last.arrival_time,
    dutyStartDate: first.date,
    legCount: legs.length,
    totalBlockHours,
    totalDutyHours,
    crossesMidnight,
    hasMadrugada,
    connectionTimes,
    debriefTime: last.debrief_time || null,
  };
}

// ── Query helpers ──

export function getTodayDutyPeriods(dutyPeriods: DutyPeriod[], todayStr: string): DutyPeriod[] {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  return dutyPeriods.filter(dp => {
    if (dp.legs.some(l => l.date === todayStr)) return true;
    if (dp.dutyStartDate === yesterdayStr && dp.crossesMidnight) return true;
    return false;
  });
}

export function getNextDutyPeriod(dutyPeriods: DutyPeriod[], todayStr: string): DutyPeriod | null {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const todayUpcoming = dutyPeriods.filter(dp => {
    if (dp.dutyStartDate !== todayStr) return false;
    const startMin = timeToMinutes(dp.dutyStartTime);
    return startMin > nowMinutes;
  });

  const future = dutyPeriods.filter(dp => dp.dutyStartDate > todayStr);
  return todayUpcoming[0] || future[0] || null;
}

export function formatDutyTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}
