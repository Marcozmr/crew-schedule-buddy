import { fromZonedTime } from 'date-fns-tz';
import {
  evaluateSchedule,
  type AircraftCategory,
  type ComplianceResult,
  type ComplianceStatus,
  type CrewRole,
  type DutyPeriodInput,
  type ScheduleWindow,
} from '@/regulation';
import { groupIntoDutyPeriods, type DutyPeriod } from '@/lib/duty-grouping';

export interface OperationalScheduleEntry {
  id: string;
  date: string;
  departure_time?: string | null;
  arrival_time?: string | null;
  flight_number: string;
  departure_airport?: string | null;
  departure?: string | null;
  arrival_airport?: string | null;
  arrival?: string | null;
  aircraft_type?: string | null;
  is_flight: boolean;
  crosses_midnight?: boolean | null;
  crew_role?: string | null;
  debrief_time?: string | null;
  report_time?: string | null;
  airline?: string | null;
}

export interface OperationalAnalysis {
  window: ScheduleWindow;
  results: ComplianceResult[];
  allAlerts: Array<ComplianceResult['alerts'][number] & { dutyDate: string }>;
  overall: ComplianceStatus;
  latest: ComplianceResult | null;
}

function parseDateParts(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m, d];
}

export function timeToMinutes(time: string | null | undefined): number {
  if (!time) return -1;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return -1;
  return h * 60 + m;
}

export function toUtcIso(date: string, time: string, timezone: string, dayOffset = 0): string {
  const [year, month, day] = parseDateParts(date);
  const [hours, minutes] = time.split(':').map(Number);
  const localDate = new Date(year, month - 1, day + dayOffset, hours || 0, minutes || 0, 0);
  return fromZonedTime(localDate, timezone).toISOString();
}

export function mapCrewRole(crewRole: string | null | undefined): CrewRole {
  const normalized = (crewRole || '').toLowerCase();
  if (normalized.includes('cmd') || normalized.includes('capt') || normalized.includes('comand')) return 'captain';
  if (normalized.includes('cop') || normalized.includes('fo') || normalized.includes('primeiro')) return 'first_officer';
  return 'cabin_crew';
}

export function mapAircraftCategory(type: string | null | undefined): AircraftCategory {
  const value = (type || '').toUpperCase();
  return /33\d|34\d|35\d|77\d|78\d|A330|A350|B777|B787/.test(value) ? 'widebody' : 'narrowbody';
}

export function inferPostFlightMinutes(arrivalTime: string, debriefTime: string | null | undefined): number {
  if (!debriefTime) return 30;
  const arrival = timeToMinutes(arrivalTime);
  let debrief = timeToMinutes(debriefTime);
  if (arrival < 0 || debrief < 0) return 30;
  if (debrief < arrival) debrief += 1440;
  const diff = debrief - arrival;
  return diff >= 0 && diff <= 180 ? diff : 30;
}

export function formatComplianceStatus(status: ComplianceStatus): string {
  if (status === 'COMPLIANT') return 'Situação normal';
  if (status === 'WARNING') return 'Atenção operacional';
  if (status === 'CRITICAL_FATIGUE' || status === 'NON_COMPLIANT') return 'Operação crítica';
  return 'Situação normal';
}

function resolveDutyLegOffsets(duty: DutyPeriod): Array<{ depDayOffset: number; arrDayOffset: number }> {
  let currentDayOffset = 0;
  let previousArrivalAbs = -1;

  return duty.legs.map((leg) => {
    const departureTime = leg.departure_time || '00:00';
    const arrivalTime = leg.arrival_time || departureTime;
    const departureMinutes = timeToMinutes(departureTime);
    const arrivalMinutes = timeToMinutes(arrivalTime);

    let depDayOffset = currentDayOffset;
    let depAbs = depDayOffset * 1440 + Math.max(0, departureMinutes);

    while (previousArrivalAbs >= 0 && depAbs < previousArrivalAbs) {
      depDayOffset += 1;
      depAbs += 1440;
    }

    let arrDayOffset = depDayOffset;
    let arrAbs = arrDayOffset * 1440 + Math.max(0, arrivalMinutes);

    while (arrAbs < depAbs) {
      arrDayOffset += 1;
      arrAbs += 1440;
    }

    currentDayOffset = depDayOffset;
    previousArrivalAbs = arrAbs;

    return { depDayOffset, arrDayOffset };
  });
}

function mapDutyPeriodToInput(
  duty: DutyPeriod,
  timezone: string,
  homeBase?: string | null,
): DutyPeriodInput {
  const offsets = resolveDutyLegOffsets(duty);
  const firstDate = duty.dutyStartDate;
  const firstLeg = duty.legs[0];
  const lastLeg = duty.legs[duty.legs.length - 1];

  const legs = duty.legs.map((leg, index) => {
    const departureTime = leg.departure_time || '00:00';
    const arrivalTime = leg.arrival_time || departureTime;
    const { depDayOffset, arrDayOffset } = offsets[index];

    return {
      id: leg.id,
      flightNumber: leg.flight_number,
      departureAirport: (leg.departure_airport || leg.departure || 'TBD').toUpperCase(),
      arrivalAirport: (leg.arrival_airport || leg.arrival || 'TBD').toUpperCase(),
      scheduledDepartureUtc: toUtcIso(firstDate, departureTime, timezone, depDayOffset),
      scheduledArrivalUtc: toUtcIso(firstDate, arrivalTime, timezone, arrDayOffset),
      aircraftCategory: mapAircraftCategory(leg.aircraft_type),
      activityType: 'flight' as const,
      crossesMidnight: arrDayOffset > depDayOffset,
    };
  });

  return {
    reportTimeUtc: toUtcIso(firstDate, duty.reportTime || duty.dutyStartTime || '00:00', timezone),
    legs,
    baseAirport: (homeBase || firstLeg.departure_airport || firstLeg.departure || 'BSB').toUpperCase(),
    crewRole: mapCrewRole(firstLeg.crew_role),
    aircraftCategory: legs.some((leg) => leg.aircraftCategory === 'widebody') ? 'widebody' : 'narrowbody',
    postFlightMinutes: inferPostFlightMinutes(lastLeg.arrival_time || '00:00', duty.debriefTime),
  } satisfies DutyPeriodInput;
}

export function buildDutyPeriodsFromSchedule(
  schedule: OperationalScheduleEntry[],
  timezone: string,
  homeBase?: string | null,
): DutyPeriodInput[] {
  return groupIntoDutyPeriods(schedule)
    .map((duty) => mapDutyPeriodToInput(duty, timezone, homeBase));
}

export function buildOperationalWindow(
  schedule: OperationalScheduleEntry[],
  timezone: string,
  homeBase?: string | null,
): ScheduleWindow | null {
  if (schedule.length === 0) return null;

  const dutyPeriods = buildDutyPeriodsFromSchedule(schedule, timezone, homeBase);
  if (dutyPeriods.length === 0) return null;

  return {
    dutyPeriods,
    referenceDate: new Date().toISOString(),
    crew: {
      crewId: 'active-crew',
      crewRole: mapCrewRole(schedule[0]?.crew_role),
      baseAirport: (homeBase || schedule[0]?.departure_airport || schedule[0]?.departure || 'BSB').toUpperCase(),
      aircraftCategory: mapAircraftCategory(schedule[0]?.aircraft_type),
      airline: schedule[0]?.airline || 'LATAM',
      timezone,
    },
  };
}

function selectRelevantResult(results: ComplianceResult[], referenceDate: string): ComplianceResult | null {
  if (results.length === 0) return null;

  const referenceMs = new Date(referenceDate).getTime();

  const current = results.find((result) => {
    const start = new Date(result.duty.reportTimeUtc).getTime();
    const end = new Date(result.duty.endTimeUtc).getTime();
    return start <= referenceMs && referenceMs <= end;
  });

  if (current) return current;

  const next = results
    .filter((result) => new Date(result.duty.reportTimeUtc).getTime() > referenceMs)
    .sort((a, b) => new Date(a.duty.reportTimeUtc).getTime() - new Date(b.duty.reportTimeUtc).getTime())[0];

  if (next) return next;

  return [...results]
    .filter((result) => new Date(result.duty.endTimeUtc).getTime() <= referenceMs)
    .sort((a, b) => new Date(b.duty.endTimeUtc).getTime() - new Date(a.duty.endTimeUtc).getTime())[0] ?? results.at(-1) ?? null;
}

export function analyzeOperationalSchedule(
  schedule: OperationalScheduleEntry[],
  timezone: string,
  homeBase?: string | null,
): OperationalAnalysis | null {
  const window = buildOperationalWindow(schedule, timezone, homeBase);
  if (!window) return null;

  const results = evaluateSchedule(window);
  const allAlerts = results.flatMap((result) => result.alerts.map((alert) => ({ ...alert, dutyDate: result.duty.reportTimeLocal })));
  const overall: ComplianceStatus = results.some((result) => result.status === 'NON_COMPLIANT' || result.status === 'CRITICAL_FATIGUE')
    ? 'NON_COMPLIANT'
    : results.some((result) => result.status === 'WARNING')
      ? 'WARNING'
      : 'COMPLIANT';

  return {
    window,
    results,
    allAlerts,
    overall,
    latest: selectRelevantResult(results, window.referenceDate),
  };
}
