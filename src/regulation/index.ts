/**
 * EscalaX Regulation Engine
 * Public API barrel export.
 */

export {
  evaluateSchedule,
  evaluateDutyPeriod,
  checkSingleDuty,
  calculateDuty,
  calculateRest,
  calculateFatigue,
  calculateWoclExposure,
  buildAlerts,
  determineComplianceStatus,
  rbac117Rules,
  aeronautaLawRules,
  latamAgreementRules,
  ENGINE_VERSION,
} from './complianceEngine';

export type {
  ComplianceResult,
  ComplianceStatus,
  DutyCalculation,
  RestCalculation,
  FatigueCalculation,
  FatigueFactor,
  WoclExposure,
  RuleResult,
  RegulationRule,
  AlertCode,
  Severity,
  RuleSource,
  ScheduleWindow,
  DutyPeriodInput,
  FlightLeg,
  CrewContext,
  CrewRole,
  AircraftCategory,
  ActivityType,
  TimeBreakdown,
  GroundGapDetail,
} from './types';

export type { StructuredAlert } from './alertsEngine';
export type { StructuredAlert as Alert } from './alertsEngine';

// Time segmentation utilities
export {
  splitIntervalByTimeWindows,
  calculateNightMinutes,
  calculateWOCLMinutes,
  calculateMadrugadaMinutes,
  classifyGroundTimes,
  classifyDutySegments,
  isMadrugadaDuty,
} from '@/lib/time-segments';

export type {
  TimeSegment,
  IntervalBreakdown,
  GroundTimeClassification,
} from '@/lib/time-segments';
