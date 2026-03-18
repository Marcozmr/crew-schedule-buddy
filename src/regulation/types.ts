/**
 * EscalaX Regulation Engine — Core Types
 * 
 * Deterministic, auditable types for crew duty/rest/fatigue compliance.
 * Designed for extensibility across airlines and regulation frameworks.
 */

// ─── Enums ───

export type ComplianceStatus =
  | 'COMPLIANT'
  | 'WARNING'
  | 'NON_COMPLIANT'
  | 'CRITICAL_FATIGUE';

export type AlertCode =
  | 'DUTY_EXCEEDED'
  | 'REST_INSUFFICIENT'
  | 'FATIGUE_RISK'
  | 'WOCL_EXPOSURE'
  | 'GROUND_TIME_EXCEEDED'
  | 'MADRUGADA_LIMIT_EXCEEDED'
  | 'FLIGHT_HOURS_EXCEEDED'
  | 'CONSECUTIVE_EARLY_STARTS'
  | 'CONSECUTIVE_NIGHT_DUTIES'
  | 'STANDBY_LIMIT_EXCEEDED'
  | 'WEEKLY_REST_INSUFFICIENT';

export type Severity = 'info' | 'warning' | 'critical';

export type RuleSource =
  | 'RBAC_117'
  | 'LEI_13475'
  | 'LATAM_ACT_2025'
  | 'INTERNAL';

export type CrewRole = 'captain' | 'first_officer' | 'relief_pilot' | 'cabin_crew';

export type AircraftCategory = 'widebody' | 'narrowbody';

export type ActivityType =
  | 'flight'
  | 'standby'
  | 'reserve'
  | 'ground_duty'
  | 'training'
  | 'day_off'
  | 'vacation'
  | 'positioning';

// ─── Input types ───

export interface FlightLeg {
  id: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  /** ISO 8601 UTC */
  scheduledDepartureUtc: string;
  /** ISO 8601 UTC */
  scheduledArrivalUtc: string;
  /** ISO 8601 UTC — actual block-off, falls back to scheduled */
  actualDepartureUtc?: string;
  /** ISO 8601 UTC — actual block-on, falls back to scheduled */
  actualArrivalUtc?: string;
  aircraftCategory: AircraftCategory;
  activityType: ActivityType;
  crossesMidnight?: boolean;
}

export interface DutyPeriodInput {
  /** ISO 8601 UTC — report time */
  reportTimeUtc: string;
  /** All legs/activities within this duty */
  legs: FlightLeg[];
  /** Crew member base airport IATA */
  baseAirport: string;
  crewRole: CrewRole;
  aircraftCategory: AircraftCategory;
  /** Pós-voo configurável (min), default 30 */
  postFlightMinutes?: number;
}

export interface CrewContext {
  crewId: string;
  crewRole: CrewRole;
  baseAirport: string;
  aircraftCategory: AircraftCategory;
  airline: string;
  /** Timezone for local-time calculations, default America/Sao_Paulo */
  timezone: string;
}

export interface ScheduleWindow {
  /** All duty periods in the analysis window */
  dutyPeriods: DutyPeriodInput[];
  /** Reference date for "current" calculations (ISO 8601 UTC) */
  referenceDate: string;
  crew: CrewContext;
}

// ─── Time segmentation ───

export interface TimeBreakdown {
  totalMinutes: number;
  diurnoMinutes: number;
  noturnoMinutes: number;
  madrugadaMinutes: number;
  woclMinutes: number;
}

export interface GroundGapDetail {
  gapIndex: number;
  startUtc: string;
  endUtc: string;
  totalMinutes: number;
  isDayGap: boolean;
  isNightGap: boolean;
  diurnoMinutes: number;
  noturnoMinutes: number;
}

// ─── Calculated output types ───

export interface DutyCalculation {
  /** Report time → último block-on + pós-voo (ms) */
  totalDutyMs: number;
  totalDutyHours: number;
  /** Sum of block-off → block-on across all legs (ms) */
  totalFlightMs: number;
  totalFlightHours: number;
  /** Number of flight sectors */
  sectorCount: number;
  /** Ground time between consecutive legs (ms per gap) */
  groundTimesBetweenLegs: number[];
  /** Classified ground gaps with day/night breakdown */
  groundGapDetails: GroundGapDetail[];
  /** Total ground time between legs (ms) */
  totalGroundTimeMs: number;
  /** Report time hour in local tz (0-23) */
  reportHourLocal: number;
  /** End-of-duty hour in local tz (0-23) */
  endHourLocal: number;
  /** Whether duty starts outside base */
  startsOutsideBase: boolean;
  /** Whether duty ends outside base */
  endsOutsideBase: boolean;
  /** ISO strings for auditability */
  reportTimeUtc: string;
  endTimeUtc: string;
  reportTimeLocal: string;
  endTimeLocal: string;
  /** Time breakdown of duty period */
  dutyTimeBreakdown: TimeBreakdown;
  /** Whether this duty touches madrugada (00:00-06:00 local) */
  isMadrugadaDuty: boolean;
  /** Pós-voo usado neste cálculo */
  postFlightMinutes: number;
}

export interface RestCalculation {
  /** Rest before this duty (ms), null if first duty in window */
  restBeforeDutyMs: number | null;
  restBeforeDutyHours: number | null;
  /** Rest after this duty (ms), null if last duty in window */
  restAfterDutyMs: number | null;
  restAfterDutyHours: number | null;
  /** Minimum required rest (hours) based on applicable rules */
  minRequiredRestHours: number;
  /** Whether rest augmentation applies (out-of-base) */
  augmentedRest: boolean;
  /** Time breakdown of rest-before period */
  restBeforeBreakdown: TimeBreakdown | null;
}

export interface WoclExposure {
  /** Total minutes of duty overlapping 02:00-06:00 local */
  totalMinutes: number;
  /** Each WOCL window crossed, with start/end UTC */
  windows: Array<{ startUtc: string; endUtc: string; durationMinutes: number }>;
}

export interface FatigueCalculation {
  /** 0-100 composite risk score */
  riskScore: number;
  /** Breakdown of contributing factors */
  factors: FatigueFactor[];
  woclExposure: WoclExposure;
  consecutiveEarlyStarts: number;
  consecutiveNightDuties: number;
  /** Madrugada count in last 168h */
  madrugadasIn168h: number;
}

export interface FatigueFactor {
  name: string;
  weight: number;
  rawValue: number;
  contribution: number;
  description: string;
}

// ─── Rule result ───

export interface RuleResult {
  ruleId: string;
  ruleSource: RuleSource;
  passed: boolean;
  severity: Severity;
  message: string;
  /** Alert code for programmatic handling */
  alertCode?: AlertCode;
  /** Raw values that triggered the rule, for audit trail */
  context?: Record<string, unknown>;
  /** The calculated value that was checked */
  calculatedValue?: number;
  /** The limit/threshold used */
  limitUsed?: number;
}

// ─── Compliance result ───

export interface ComplianceResult {
  status: ComplianceStatus;
  /** All rule evaluations, passed or failed */
  rules: RuleResult[];
  /** Only failed rules */
  alerts: RuleResult[];
  /** Duty calculation for the evaluated period */
  duty: DutyCalculation;
  /** Rest calculation */
  rest: RestCalculation;
  /** Fatigue assessment */
  fatigue: FatigueCalculation;
  /** Accumulated flight hours in sliding windows */
  accumulatedHours: {
    last7Days: number;
    last28Days: number;
    last30Days: number;
    last90Days: number;
    last365Days: number;
  };
  /** ISO timestamp of when this result was computed */
  computedAt: string;
  /** Engine version for traceability */
  engineVersion: string;
}

// ─── Rule interface (rule engine pattern) ───

export interface RegulationRule {
  ruleId: string;
  ruleSource: RuleSource;
  description: string;
  evaluate(
    duty: DutyCalculation,
    rest: RestCalculation,
    fatigue: FatigueCalculation,
    context: ScheduleWindow,
    accumulatedHours: ComplianceResult['accumulatedHours']
  ): RuleResult;
}
