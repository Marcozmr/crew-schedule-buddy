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

export function buildDutyPeriodsFromSchedule(
  schedule: OperationalScheduleEntry[],
  timezone: string,
  homeBase?: string | null,
): DutyPeriodInput[] {
  const groups = new Map<string, OperationalScheduleEntry[]>();

  schedule.forEach((entry) => {
    const report = entry.report_time || entry.departure_time || '00:00';
    const key = `${entry.date}_${report}`;
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  });

  return Array.from(groups.values())
    .sort((a, b) => {
      const aReport = a[0]?.report_time || a[0]?.departure_time || '00:00';
      const bReport = b[0]?.report_time || b[0]?.departure_time || '00:00';
      return toUtcIso(a[0].date, aReport, timezone).localeCompare(toUtcIso(b[0].date, bReport, timezone));
    })
    .map((duty) => {
      const legs = duty.map((leg) => {
        const departureTime = leg.departure_time || '00:00';
        const arrivalTime = leg.arrival_time || departureTime;
        const depUtc = toUtcIso(leg.date, departureTime, timezone);
        const arrDayOffset = leg.crosses_midnight || timeToMinutes(arrivalTime) < timeToMinutes(departureTime) ? 1 : 0;
        const arrUtc = toUtcIso(leg.date, arrivalTime, timezone, arrDayOffset);

        return {
          id: leg.id,
          flightNumber: leg.flight_number,
          departureAirport: (leg.departure_airport || leg.departure || 'TBD').toUpperCase(),
          arrivalAirport: (leg.arrival_airport || leg.arrival || 'TBD').toUpperCase(),
          scheduledDepartureUtc: depUtc,
          scheduledArrivalUtc: arrUtc,
          aircraftCategory: mapAircraftCategory(leg.aircraft_type),
          activityType: (leg.is_flight ? 'flight' : 'ground_duty') as 'flight' | 'ground_duty',
          crossesMidnight: !!leg.crosses_midnight,
        };
      });

      const first = duty[0];
      const last = duty[duty.length - 1];
      const reportLocal = first.report_time || first.departure_time || '00:00';
      const reportTimeUtc = toUtcIso(first.date, reportLocal, timezone);
      const baseAirport = (homeBase || first.departure_airport || first.departure || 'BSB').toUpperCase();

      return {
        reportTimeUtc,
        legs,
        baseAirport,
        crewRole: mapCrewRole(first.crew_role),
        aircraftCategory: legs.some((leg) => leg.aircraftCategory === 'widebody') ? 'widebody' : 'narrowbody',
        postFlightMinutes: inferPostFlightMinutes(last.arrival_time || '00:00', last.debrief_time),
      } satisfies DutyPeriodInput;
    });
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
    latest: results.at(-1) ?? null,
  };
}
