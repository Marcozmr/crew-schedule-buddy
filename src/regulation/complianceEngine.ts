/**
 * EscalaX Regulation Engine — Compliance Engine
 * 
 * Orchestrates all calculators and rules to produce a full compliance result.
 * Designed like Jeppesen Crew Manager architecture:
 * - Deterministic calculations
 * - Auditable rule results
 * - Extensible rule registry
 * 
 * @version 1.0.0
 */

import type {
  ScheduleWindow,
  DutyPeriodInput,
  ComplianceResult,
  RegulationRule,
  RuleResult,
  DutyCalculation,
  RestCalculation,
  FatigueCalculation,
} from './types';
import { calculateDuty } from './dutyCalculator';
import { calculateRest } from './restCalculator';
import { calculateFatigue } from './fatigueCalculator';
import { rbac117Rules } from './rbac117Rules';
import { aeronautaLawRules } from './aeronautaLawRules';
import { latamAgreementRules } from './latamAgreementRules';
import { buildAlerts, determineComplianceStatus } from './alertsEngine';

export const ENGINE_VERSION = '1.0.0';

/**
 * Default rule registry: LATAM ACT > RBAC 117 > Lei 13.475
 * LATAM ACT rules take priority (evaluated first, more specific).
 */
function getDefaultRules(airline: string): RegulationRule[] {
  const rules: RegulationRule[] = [
    ...aeronautaLawRules,     // Base legal (Lei 13.475)
    ...rbac117Rules,          // ANAC regulation (RBAC 117)
  ];

  // Add airline-specific rules
  if (airline.toUpperCase().includes('LATAM') || airline.toUpperCase().includes('TAM') || airline.toUpperCase() === 'LA' || airline.toUpperCase() === 'JJ') {
    rules.push(...latamAgreementRules);
  }

  return rules;
}

/**
 * Calculate accumulated flight hours across sliding windows.
 */
function calculateAccumulatedHours(
  allDuties: DutyCalculation[],
  referenceDate: string
): ComplianceResult['accumulatedHours'] {
  const refMs = new Date(referenceDate).getTime();
  const MS_PER_DAY = 86400000;

  const sumFlightHours = (windowDays: number): number => {
    const cutoff = refMs - windowDays * MS_PER_DAY;
    return allDuties
      .filter(d => new Date(d.reportTimeUtc).getTime() >= cutoff && new Date(d.reportTimeUtc).getTime() <= refMs)
      .reduce((sum, d) => sum + d.totalFlightHours, 0);
  };

  return {
    last7Days: round2(sumFlightHours(7)),
    last28Days: round2(sumFlightHours(28)),
    last30Days: round2(sumFlightHours(30)),
    last365Days: round2(sumFlightHours(365)),
  };
}

/**
 * Evaluate a single duty period against all applicable rules.
 */
export function evaluateDutyPeriod(
  dutyIndex: number,
  allDuties: DutyCalculation[],
  window: ScheduleWindow,
  customRules?: RegulationRule[]
): ComplianceResult {
  const tz = window.crew.timezone || 'America/Sao_Paulo';
  const duty = allDuties[dutyIndex];
  const rest = calculateRest(dutyIndex, allDuties, window);
  const fatigue = calculateFatigue(duty, allDuties, dutyIndex, tz);
  const accumulatedHours = calculateAccumulatedHours(allDuties, window.referenceDate);

  // Determine applicable rules
  const rules = customRules || getDefaultRules(window.crew.airline);

  // Evaluate every rule
  const ruleResults: RuleResult[] = rules.map(rule =>
    rule.evaluate(duty, rest, fatigue, window, accumulatedHours)
  );

  // Add fatigue score rule
  const fatigueRule: RuleResult = {
    ruleId: 'FATIGUE_COMPOSITE_SCORE',
    ruleSource: 'INTERNAL',
    passed: fatigue.riskScore < 70,
    severity: fatigue.riskScore >= 80 ? 'critical' : fatigue.riskScore >= 60 ? 'warning' : 'info',
    message: `Score de fadiga: ${fatigue.riskScore}/100`,
    alertCode: fatigue.riskScore >= 60 ? 'FATIGUE_RISK' : undefined,
    context: { score: fatigue.riskScore, factors: fatigue.factors },
  };
  ruleResults.push(fatigueRule);

  const alerts = ruleResults.filter(r => !r.passed);
  const status = determineComplianceStatus(ruleResults, fatigue.riskScore);

  return {
    status,
    rules: ruleResults,
    alerts,
    duty,
    rest,
    fatigue,
    accumulatedHours,
    computedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
  };
}

/**
 * Evaluate all duty periods in a schedule window.
 * Returns compliance results per duty period.
 */
export function evaluateSchedule(
  window: ScheduleWindow,
  customRules?: RegulationRule[]
): ComplianceResult[] {
  const tz = window.crew.timezone || 'America/Sao_Paulo';

  // Calculate all duties first
  const allDuties: DutyCalculation[] = window.dutyPeriods.map(dp =>
    calculateDuty(dp, tz)
  );

  // Evaluate each duty period
  return allDuties.map((_, index) =>
    evaluateDutyPeriod(index, allDuties, window, customRules)
  );
}

/**
 * Quick compliance check for a single duty period (most common use case).
 */
export function checkSingleDuty(
  dutyPeriod: DutyPeriodInput,
  previousDuties: DutyPeriodInput[],
  crew: ScheduleWindow['crew'],
  referenceDate?: string
): ComplianceResult {
  const window: ScheduleWindow = {
    dutyPeriods: [...previousDuties, dutyPeriod],
    referenceDate: referenceDate || new Date().toISOString(),
    crew,
  };

  const tz = crew.timezone || 'America/Sao_Paulo';
  const allDuties = window.dutyPeriods.map(dp => calculateDuty(dp, tz));
  const targetIndex = allDuties.length - 1;

  return evaluateDutyPeriod(targetIndex, allDuties, window);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Re-export types and calculators for external use
export { calculateDuty } from './dutyCalculator';
export { calculateRest } from './restCalculator';
export { calculateFatigue, calculateWoclExposure } from './fatigueCalculator';
export { buildAlerts, determineComplianceStatus } from './alertsEngine';
export { rbac117Rules } from './rbac117Rules';
export { aeronautaLawRules } from './aeronautaLawRules';
export { latamAgreementRules } from './latamAgreementRules';
export type * from './types';
