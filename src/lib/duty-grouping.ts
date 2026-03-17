/**
 * Duty Period Grouping Engine
 * 
 * Groups individual flight legs into operational duty periods based on
 * presentation time (APR), continuity, and a configurable gap threshold.
 * Handles midnight-crossing flights correctly.
 */

import type { ScheduleEntry } from '@/hooks/useScheduleData';

export interface DutyPeriod {
  /** Unique key for React rendering */
  id: string;
  /** All legs in operational order */
  legs: ScheduleEntry[];
  /** Route summary e.g. "BSB → JPA → GRU" */
  routeSummary: string;
  /** Presentation time (HH:mm) from first leg */
  reportTime: string | null;
  /** First departure time */
  dutyStartTime: string;
  /** Last arrival time */
  dutyEndTime: string;
  /** Calendar date of the duty start (from first leg) */
  dutyStartDate: string;
  /** Number of flight legs */
  legCount: number;
  /** Total block (flight) hours */
  totalBlockHours: number;
  /** Total duty hours (from first leg's report to last arrival + 30min debrief) */
  totalDutyHours: number;
  /** Whether the duty crosses midnight */
  crossesMidnight: boolean;
  /** Whether any leg operates in madrugada (00:00-05:59 BRT) */
  hasMadrugada: boolean;
  /** Connection times between legs in minutes */
  connectionTimes: number[];
  /** Debrief time of last leg */
  debriefTime: string | null;
}

/**
 * Parse "HH:mm" to total minutes from midnight.
 * Returns -1 for invalid input.
 */
function timeToMinutes(t: string | null | undefined): number {
  if (!t) return -1;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return -1;
  return h * 60 + m;
}

function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Get the effective sort key for a schedule entry.
 * Uses sort_datetime first, then constructs from date + report_time or departure_time.
 */
function getEffectiveSortKey(e: ScheduleEntry): string {
  if (e.sort_datetime) return e.sort_datetime;
  const time = e.report_time || e.departure_time || '00:00';
  return `${e.date}T${time}`;
}

/**
 * Determine if arrival time indicates midnight crossing relative to departure.
 */
function didCrossMidnight(depTime: string, arrTime: string): boolean {
  const depMin = timeToMinutes(depTime);
  const arrMin = timeToMinutes(arrTime);
  if (depMin < 0 || arrMin < 0) return false;
  return arrMin < depMin;
}

/**
 * Check if a time falls in the madrugada window (00:00-05:59).
 */
function isMadrugada(time: string | null | undefined): boolean {
  const mins = timeToMinutes(time);
  if (mins < 0) return false;
  return mins < 360; // 6 * 60
}

/**
 * Groups schedule entries into duty periods.
 * 
 * Algorithm:
 * 1. Filter to flights only, sort by effective sort key (sort_datetime or date+report_time)
 * 2. Group consecutive flights where gap between previous arrival and next departure < threshold
 * 3. For midnight-crossing, adjust times by +1440 mins when arrival < departure
 * 
 * @param entries All schedule entries
 * @param gapThresholdMinutes Max gap between legs to consider same duty (default 600 = 10h)
 */
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

    // Calculate gap between previous arrival and current departure
    let prevArrMin = timeToMinutes(prev.arrival_time);
    const prevDepMin = timeToMinutes(prev.departure_time);
    let currDepMin = timeToMinutes(curr.report_time || curr.departure_time);

    // Adjust for midnight crossing on previous leg
    if (prevArrMin >= 0 && prevDepMin >= 0 && prevArrMin < prevDepMin) {
      prevArrMin += 1440;
    }
    // Also if prev and curr are on different dates
    if (prev.date !== curr.date) {
      // curr is on a later date, so add 1440 per day difference
      const prevDate = new Date(prev.date + 'T00:00:00');
      const currDate = new Date(curr.date + 'T00:00:00');
      const dayDiff = Math.round((currDate.getTime() - prevDate.getTime()) / 86400000);
      if (dayDiff > 0 && currDepMin >= 0) {
        currDepMin += dayDiff * 1440;
      }
    }
    // If prev arrival crosses midnight relative to prev departure, it's already on next day
    // So the gap is currDepMin - prevArrMin
    const gap = (prevArrMin >= 0 && currDepMin >= 0) ? (currDepMin - prevArrMin) : 9999;

    if (gap >= 0 && gap < gapThresholdMinutes) {
      currentGroup.push(curr);
    } else {
      groups.push(currentGroup);
      currentGroup = [curr];
    }
  }
  groups.push(currentGroup);

  return groups.map(legs => buildDutyPeriod(legs));
}

function buildDutyPeriod(legs: ScheduleEntry[]): DutyPeriod {
  const first = legs[0];
  const last = legs[legs.length - 1];

  // Route summary: BSB → JPA → GRU
  const airports: string[] = [first.departure];
  for (const leg of legs) {
    airports.push(leg.arrival);
  }
  const routeSummary = airports.join(' → ');

  // Connection times
  const connectionTimes: number[] = [];
  for (let i = 1; i < legs.length; i++) {
    const prevArr = timeToMinutes(legs[i - 1].arrival_time);
    const currDep = timeToMinutes(legs[i].departure_time);
    if (prevArr >= 0 && currDep >= 0) {
      let conn = currDep - prevArr;
      // If negative, arrival crossed midnight
      if (conn < 0) conn += 1440;
      connectionTimes.push(conn);
    } else {
      connectionTimes.push(0);
    }
  }

  // Total block hours
  const totalBlockHours = legs.reduce((s, l) => s + (l.flight_hours || 0), 0);

  // Total duty hours: from report_time of first leg to arrival of last + 30min debrief
  const reportMin = timeToMinutes(first.report_time || first.departure_time);
  let lastArrMin = timeToMinutes(last.arrival_time);
  // Adjust for midnight crossing across the duty
  if (reportMin >= 0 && lastArrMin >= 0) {
    if (lastArrMin < reportMin) lastArrMin += 1440;
  }
  const rawDutyMins = (reportMin >= 0 && lastArrMin >= 0)
    ? (lastArrMin - reportMin + 30) // +30 debrief
    : legs.reduce((s, l) => s + (l.duty_hours || 0) * 60, 0);
  const totalDutyHours = Math.round((rawDutyMins / 60) * 100) / 100;

  // Midnight crossing
  const crossesMidnight = legs.some(l => l.crosses_midnight) ||
    legs.some(l => didCrossMidnight(l.departure_time, l.arrival_time)) ||
    (first.date !== last.date);

  // Madrugada
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

/**
 * Get duty periods operationally active "today".
 * A duty is "today" if:
 * - Any leg's date is today, OR
 * - The duty started yesterday and crosses midnight (legs arrive today)
 */
export function getTodayDutyPeriods(dutyPeriods: DutyPeriod[], todayStr: string): DutyPeriod[] {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  return dutyPeriods.filter(dp => {
    // Any leg on today
    if (dp.legs.some(l => l.date === todayStr)) return true;
    // Duty started yesterday and crosses midnight
    if (dp.dutyStartDate === yesterdayStr && dp.crossesMidnight) return true;
    return false;
  });
}

/**
 * Get the next upcoming duty period.
 */
export function getNextDutyPeriod(dutyPeriods: DutyPeriod[], todayStr: string): DutyPeriod | null {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Today's duties that haven't started yet
  const todayUpcoming = dutyPeriods
    .filter(dp => {
      if (dp.dutyStartDate !== todayStr) return false;
      const startMin = timeToMinutes(dp.dutyStartTime);
      return startMin > nowMinutes;
    });

  // Future duties
  const future = dutyPeriods.filter(dp => dp.dutyStartDate > todayStr);

  return todayUpcoming[0] || future[0] || null;
}

/**
 * Format minutes as "Xh Ymin"
 */
export function formatDutyTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}
