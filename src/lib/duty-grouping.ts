/**
 * Duty Period Grouping Engine v3
 * 
 * Groups flight legs into operational duty periods with:
 * - Airport continuity validation (prev.arrival === next.departure)
 * - Ordering by presentation time (APR) not just departure
 * - Correct midnight-crossing handling
 * - Absolute-minute based sorting for duty period ordering
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

/** Absolute minutes from a fixed epoch (2020-01-01) for cross-date sorting */
const EPOCH = new Date('2020-01-01T00:00:00').getTime();
function dateTimeToAbsMin(date: string, time: string | null | undefined): number {
  const mins = timeToMinutes(time);
  if (mins < 0) return -1;
  const dayMs = new Date(date + 'T00:00:00').getTime() - EPOCH;
  return Math.round(dayMs / 60000) + mins;
}

/**
 * Effective sort key: sort_datetime > date+report_time > date+departure_time.
 */
function getEffectiveSortKey(e: ScheduleEntry): string {
  if (e.sort_datetime) return e.sort_datetime;
  const time = e.report_time || e.departure_time || '00:00';
  return `${e.date}T${time}`;
}

function absoluteMinutes(date: string, time: string | null | undefined, refDate: string): number {
  const mins = timeToMinutes(time);
  if (mins < 0) return -1;
  const d = new Date(date + 'T00:00:00');
  const r = new Date(refDate + 'T00:00:00');
  const dayOffset = Math.round((d.getTime() - r.getTime()) / 86400000);
  return dayOffset * 1440 + mins;
}

// ── Chaining validation ──

function canChainLegs(
  prevLeg: ScheduleEntry,
  nextLeg: ScheduleEntry,
  maxConnectionMinutes: number
): boolean {
  // Rule 1: Airport continuity
  const prevDest = (prevLeg.arrival || '').toUpperCase().trim();
  const nextOrig = (nextLeg.departure || '').toUpperCase().trim();
  if (!prevDest || !nextOrig || prevDest !== nextOrig) return false;

  // Rule 2 & 3: Temporal gap
  const refDate = prevLeg.date;
  let prevArrAbs = absoluteMinutes(prevLeg.date, prevLeg.arrival_time, refDate);
  const prevDepAbs = absoluteMinutes(prevLeg.date, prevLeg.departure_time, refDate);
  if (prevArrAbs >= 0 && prevDepAbs >= 0 && prevArrAbs < prevDepAbs) {
    prevArrAbs += 1440; // crossed midnight
  }

  let nextDepAbs = absoluteMinutes(nextLeg.date, nextLeg.departure_time, refDate);
  if (nextDepAbs >= 0 && prevArrAbs >= 0 && nextDepAbs < prevArrAbs) {
    const dayDiff = Math.round(
      (new Date(nextLeg.date + 'T00:00:00').getTime() - new Date(prevLeg.date + 'T00:00:00').getTime()) / 86400000
    );
    if (dayDiff === 0) nextDepAbs += 1440;
  }

  if (prevArrAbs < 0 || nextDepAbs < 0) return false;
  const gap = nextDepAbs - prevArrAbs;
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

  const crossesMidnight = legs.some(l => l.crosses_midnight) ||
    legs.some(l => didCrossMidnight(l.departure_time, l.arrival_time)) ||
    (first.date !== last.date);

  const hasMadrugada = legs.some(l =>
    isMadrugada(l.departure_time) || isMadrugada(l.arrival_time)
  );

  // Absolute start for cross-date sorting
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
  };
}

// ── Query helpers ──

export function getTodayDutyPeriods(dutyPeriods: DutyPeriod[], todayStr: string): DutyPeriod[] {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const result = dutyPeriods.filter(dp => {
    if (dp.legs.some(l => l.date === todayStr)) return true;
    if (dp.dutyStartDate === yesterdayStr && dp.crossesMidnight) return true;
    return false;
  });

  // Sort by absolute start time (earliest duty first at top)
  result.sort((a, b) => a.dutyStartAbsoluteMin - b.dutyStartAbsoluteMin);
  return result;
}

export function getNextDutyPeriod(dutyPeriods: DutyPeriod[], todayStr: string): DutyPeriod | null {
  const now = new Date();
  const nowAbsMin = dateTimeToAbsMin(todayStr, `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);

  // Find first duty that starts after now
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
