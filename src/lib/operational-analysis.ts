import { fromZonedTime } from 'date-fns-tz';
import {
  evaluateSchedule,
  type AircraftCategory,
  type ComplianceResult,
  type ComplianceStatus,
  type CrewRole,
  type DutyPeriodInput,
  type RuleResult,
  type ScheduleWindow,
} from '@/regulation';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { groupIntoDutyPeriods, type DutyPeriod } from '@/lib/duty-grouping';
import { countsAsOperationalFlightBlockHours } from '@/lib/operational-flight-hours';
import type { ActivityType } from '@/regulation/types';

export interface OperationalScheduleEntry {
  id: string;
  date: string;
  departure_time: string;
  arrival_time: string;
  flight_number: string;
  departure_airport: string | null;
  departure: string;
  arrival_airport: string | null;
  arrival: string;
  aircraft_type: string | null;
  is_flight: boolean;
  crosses_midnight: boolean;
  crew_role: string | null;
  debrief_time: string | null;
  report_time: string | null;
  airline: string | null;
  status: string;
  duty_hours: number | null;
  flight_hours: number | null;
  activity_type: string;
  pairing_code: string | null;
  overnight: boolean;
  operation_type: string | null;
  assignment: string | null;
  comments: string | null;
  sort_datetime: string | null;
  hotel_name: string | null;
  raw_line: string | null;
  entry_type?: string | null;
  crew_status_code?: string | null;
  crew_status_label?: string | null;
}

export interface OperationalAnalysis {
  window: ScheduleWindow;
  results: ComplianceResult[];
  allAlerts: Array<ComplianceResult['alerts'][number] & { dutyDate: string }>;
  focusAlerts: Array<ComplianceResult['alerts'][number] & { dutyDate: string }>;
  overall: ComplianceStatus;
  latest: ComplianceResult | null;
  focus: ComplianceResult | null;
}

export interface DashboardStatusSummary {
  tone: 'regular' | 'attention' | 'review' | 'critical';
  label: 'Regular' | 'Atenção' | 'Revisar' | 'Crítico';
  subtitle: string;
  reason?: string;
}

export interface MonthlyStatusSummary extends DashboardStatusSummary {
  usedHours: number;
  limitHours: number;
  metricLabel: string;
  windowLabel: string;
}

const CURRENT_OPERATION_RULE_IDS = new Set([
  'RBAC117_MAX_DUTY',
  'RBAC117_MAX_FLIGHT',
  'RBAC117_MIN_REST',
  'LEI13475_MAX_DUTY_ABSOLUTE',
  'LEI13475_MIN_REST_12H',
  'LATAM_ACT_GROUND_TIME',
  'LATAM_ACT_REST_AUGMENTATION',
]);

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
  if (status === 'COMPLIANT') return 'Regular';
  if (status === 'WARNING') return 'Atenção';
  if (status === 'CRITICAL_FATIGUE' || status === 'NON_COMPLIANT') return 'Crítico';
  return 'Regular';
}

function usageRatio(rule?: Pick<RuleResult, 'calculatedValue' | 'limitUsed'>): number {
  if (!rule?.limitUsed || rule.limitUsed <= 0 || rule.calculatedValue == null) return 0;
  return rule.calculatedValue / rule.limitUsed;
}

function describeOperationalIssue(rule: RuleResult): string {
  if (rule.ruleId === 'RBAC117_MIN_REST' || rule.ruleId === 'LEI13475_MIN_REST_12H' || rule.ruleId === 'LATAM_ACT_REST_AUGMENTATION') {
    return 'Descanso abaixo do mínimo';
  }

  if (rule.ruleId === 'RBAC117_MAX_DUTY' || rule.ruleId === 'LEI13475_MAX_DUTY_ABSOLUTE') {
    return 'Limite de jornada atingido';
  }

  if (rule.ruleId === 'RBAC117_MAX_FLIGHT') {
    return 'Limite de horas de voo atingido';
  }

  if (rule.ruleId === 'LATAM_ACT_GROUND_TIME') {
    return 'Conexão acima do permitido';
  }

  return 'Encontramos um ponto que precisa conferência';
}

export function getOperationalStatusSummary(result: ComplianceResult | null): DashboardStatusSummary {
  if (!result) {
    return {
      tone: 'regular',
      label: 'Regular',
      subtitle: 'Operação dentro do esperado',
    };
  }

  const currentRules = result.rules.filter((rule) => CURRENT_OPERATION_RULE_IDS.has(rule.ruleId));
  const criticalIssue = currentRules.find((rule) => !rule.passed && rule.severity === 'critical');

  if (criticalIssue) {
    return {
      tone: 'critical',
      label: 'Crítico',
      subtitle: 'Há uma violação operacional',
      reason: describeOperationalIssue(criticalIssue),
    };
  }

  const reviewIssue = currentRules.find((rule) => !rule.passed);
  if (reviewIssue) {
    return {
      tone: 'review',
      label: 'Revisar',
      subtitle: 'Encontramos um ponto que precisa conferência',
      reason: describeOperationalIssue(reviewIssue),
    };
  }

  return {
    tone: 'regular',
    label: 'Regular',
    subtitle: 'Operação dentro do esperado',
  };
}

export function getMonthlyStatusSummary(result: ComplianceResult | null): MonthlyStatusSummary {
  const monthlyRule = result?.rules.find((rule) => rule.ruleId === 'RBAC117_FH_MONTH');
  const usedHours = monthlyRule?.calculatedValue ?? result?.accumulatedHours.last30Days ?? 0;
  const limitHours = monthlyRule?.limitUsed ?? 85;
  const ratio = usageRatio(monthlyRule);
  const limitLabel = `${limitHours}h`;

  if (!monthlyRule || !monthlyRule.passed) {
    return {
      tone: monthlyRule ? 'critical' : 'regular',
      label: monthlyRule ? 'Crítico' : 'Regular',
      subtitle: monthlyRule ? `Limite de ${limitLabel} excedido` : `Dentro do limite de ${limitLabel}`,
      reason: 'Tempo de voo acumulado nos últimos 30 dias.',
      usedHours,
      limitHours,
      metricLabel: 'Tempo de voo',
      windowLabel: 'Últimos 30 dias',
    };
  }

  if (ratio >= 0.85 || monthlyRule.severity === 'warning') {
    return {
      tone: 'attention',
      label: 'Atenção',
      subtitle: `Próximo do limite de ${limitLabel}`,
      reason: 'Tempo de voo acumulado nos últimos 30 dias.',
      usedHours,
      limitHours,
      metricLabel: 'Tempo de voo',
      windowLabel: 'Últimos 30 dias',
    };
  }

  return {
    tone: 'regular',
    label: 'Regular',
    subtitle: `Dentro do limite de ${limitLabel}`,
    reason: 'Tempo de voo acumulado nos últimos 30 dias.',
    usedHours,
    limitHours,
    metricLabel: 'Tempo de voo',
    windowLabel: 'Últimos 30 dias',
  };
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
): DutyPeriodInput | null {
  const flightLegs = duty.legs.filter((l) => l.is_flight);
  if (flightLegs.length === 0) return null;

  const offsets = resolveDutyLegOffsets({ ...duty, legs: flightLegs });
  const firstDate = duty.dutyStartDate;
  const firstLeg = flightLegs[0];
  const lastLeg = flightLegs[flightLegs.length - 1];

  const legs = flightLegs.map((leg, index) => {
    const departureTime = leg.departure_time || '00:00';
    const arrivalTime = leg.arrival_time || departureTime;
    const { depDayOffset, arrDayOffset } = offsets[index];

    const se = leg as ScheduleEntry;
    const code = (se.crew_status_code || '').toUpperCase().trim();
    const activityType: ActivityType =
      code === 'PS' || code === 'PSB' || code === 'PSI' ? 'positioning' : 'flight';

    return {
      id: leg.id,
      flightNumber: leg.flight_number,
      departureAirport: (leg.departure_airport || leg.departure || 'TBD').toUpperCase(),
      arrivalAirport: (leg.arrival_airport || leg.arrival || 'TBD').toUpperCase(),
      scheduledDepartureUtc: toUtcIso(firstDate, departureTime, timezone, depDayOffset),
      scheduledArrivalUtc: toUtcIso(firstDate, arrivalTime, timezone, arrDayOffset),
      aircraftCategory: mapAircraftCategory(leg.aircraft_type),
      activityType,
      crossesMidnight: arrDayOffset > depDayOffset,
      countsTowardFlightHourLimit: countsAsOperationalFlightBlockHours(se),
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
  return groupIntoDutyPeriods(schedule as unknown as ScheduleEntry[])
    .map((duty) => mapDutyPeriodToInput(duty, timezone, homeBase))
    .filter((d): d is DutyPeriodInput => d != null);
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

function selectRelevantResult(
  results: ComplianceResult[],
  referenceDate: string,
  options?: { includePast?: boolean },
): ComplianceResult | null {
  if (results.length === 0) return null;

  const includePast = options?.includePast ?? true;
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
  if (!includePast) return null;

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
  const focus = selectRelevantResult(results, window.referenceDate, { includePast: false });
  const focusAlerts = focus ? focus.alerts.map((alert) => ({ ...alert, dutyDate: focus.duty.reportTimeLocal })) : [];
  const overall: ComplianceStatus = results.some((result) => result.status === 'NON_COMPLIANT' || result.status === 'CRITICAL_FATIGUE')
    ? 'NON_COMPLIANT'
    : results.some((result) => result.status === 'WARNING')
      ? 'WARNING'
      : 'COMPLIANT';

  return {
    window,
    results,
    allAlerts,
    focusAlerts,
    overall,
    latest: selectRelevantResult(results, window.referenceDate),
    focus,
  };
}
