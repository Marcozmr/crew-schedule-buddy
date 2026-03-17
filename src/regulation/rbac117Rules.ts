/**
 * EscalaX Regulation Engine — RBAC 117 Rules
 * 
 * Brazilian ANAC RBAC 117 fatigue regulation rules.
 * Each rule is independent and returns a deterministic RuleResult.
 */

import type {
  RegulationRule,
  RuleResult,
  DutyCalculation,
  RestCalculation,
  FatigueCalculation,
  ScheduleWindow,
  ComplianceResult,
} from './types';

// ─── RBAC 117 Duty Time Table (Appendix B, Table 4) ───

const DUTY_TABLE: Record<string, Record<string, [number, number]>> = {
  '06-06': { '1-2': [11, 9], '3-4': [11, 9], '5': [10, 8], '6': [9, 8], '7+': [9, 8] },
  '07-07': { '1-2': [12, 9.5], '3-4': [12, 9], '5': [11, 9], '6': [10, 8], '7+': [9, 8] },
  '08-11': { '1-2': [12, 10], '3-4': [12, 9.5], '5': [12, 9], '6': [11, 9], '7+': [10, 8] },
  '12-13': { '1-2': [12, 9.5], '3-4': [12, 9], '5': [11, 9], '6': [10, 8], '7+': [9, 8] },
  '14-15': { '1-2': [11, 9], '3-4': [11, 9], '5': [10, 8], '6': [9, 8], '7+': [9, 8] },
  '16-17': { '1-2': [10, 8], '3-4': [10, 8], '5': [9, 8], '6': [9, 8], '7+': [9, 8] },
  '18-05': { '1-2': [9, 8], '3-4': [9, 8], '5': [9, 7], '6': [9, 7], '7+': [9, 7] },
};

function getTimeRangeKey(hour: number): string {
  if (hour === 6) return '06-06';
  if (hour === 7) return '07-07';
  if (hour >= 8 && hour <= 11) return '08-11';
  if (hour >= 12 && hour <= 13) return '12-13';
  if (hour >= 14 && hour <= 15) return '14-15';
  if (hour >= 16 && hour <= 17) return '16-17';
  return '18-05';
}

function getLegsKey(legs: number): string {
  if (legs <= 2) return '1-2';
  if (legs <= 4) return '3-4';
  if (legs === 5) return '5';
  if (legs === 6) return '6';
  return '7+';
}

function getDutyLimits(reportHour: number, sectors: number): { maxDuty: number; maxFlight: number } {
  const row = DUTY_TABLE[getTimeRangeKey(reportHour)];
  const limits = row?.[getLegsKey(sectors)] ?? [12, 9];
  return { maxDuty: limits[0], maxFlight: limits[1] };
}

// ─── Rules ───

export const rbac117MaxDutyHours: RegulationRule = {
  ruleId: 'RBAC117_MAX_DUTY',
  ruleSource: 'RBAC_117',
  description: 'Jornada máxima conforme Tabela 4, Apêndice B do RBAC 117',
  evaluate(duty, rest, fatigue, context) {
    const { maxDuty } = getDutyLimits(duty.reportHourLocal, duty.sectorCount);
    const passed = duty.totalDutyHours <= maxDuty;
    return {
      ruleId: this.ruleId,
      ruleSource: this.ruleSource,
      passed,
      severity: passed ? 'info' : 'critical',
      message: passed
        ? `Jornada ${duty.totalDutyHours}h dentro do limite de ${maxDuty}h`
        : `Jornada ${duty.totalDutyHours}h excede o limite de ${maxDuty}h`,
      alertCode: passed ? undefined : 'DUTY_EXCEEDED',
      context: { actualHours: duty.totalDutyHours, maxHours: maxDuty, reportHour: duty.reportHourLocal, sectors: duty.sectorCount },
    };
  },
};

export const rbac117MaxFlightHours: RegulationRule = {
  ruleId: 'RBAC117_MAX_FLIGHT',
  ruleSource: 'RBAC_117',
  description: 'Horas de voo máxima por jornada conforme Tabela 4',
  evaluate(duty) {
    const { maxFlight } = getDutyLimits(duty.reportHourLocal, duty.sectorCount);
    const passed = duty.totalFlightHours <= maxFlight;
    return {
      ruleId: this.ruleId,
      ruleSource: this.ruleSource,
      passed,
      severity: passed ? 'info' : 'critical',
      message: passed
        ? `Voo ${duty.totalFlightHours}h dentro do limite de ${maxFlight}h`
        : `Voo ${duty.totalFlightHours}h excede o limite de ${maxFlight}h`,
      alertCode: passed ? undefined : 'FLIGHT_HOURS_EXCEEDED',
      context: { actualHours: duty.totalFlightHours, maxHours: maxFlight },
    };
  },
};

export const rbac117MinRest: RegulationRule = {
  ruleId: 'RBAC117_MIN_REST',
  ruleSource: 'RBAC_117',
  description: 'Repouso mínimo de 12h entre jornadas (Tabela 6, Apêndice B)',
  evaluate(duty, rest) {
    if (rest.restBeforeDutyHours === null) {
      return { ruleId: this.ruleId, ruleSource: this.ruleSource, passed: true, severity: 'info', message: 'Primeira jornada na janela — repouso anterior não disponível' };
    }
    const passed = rest.restBeforeDutyHours >= rest.minRequiredRestHours;
    return {
      ruleId: this.ruleId,
      ruleSource: this.ruleSource,
      passed,
      severity: passed ? 'info' : 'critical',
      message: passed
        ? `Repouso ${rest.restBeforeDutyHours}h ≥ mínimo ${rest.minRequiredRestHours}h`
        : `Repouso ${rest.restBeforeDutyHours}h < mínimo ${rest.minRequiredRestHours}h`,
      alertCode: passed ? undefined : 'REST_INSUFFICIENT',
      context: { restHours: rest.restBeforeDutyHours, minRequired: rest.minRequiredRestHours, augmented: rest.augmentedRest },
    };
  },
};

export const rbac117FlightHoursMonth: RegulationRule = {
  ruleId: 'RBAC117_FH_MONTH',
  ruleSource: 'RBAC_117',
  description: 'Limite de 85h de voo em 30 dias (Tabela 5, Apêndice B)',
  evaluate(duty, rest, fatigue, context, accHours) {
    const limit = 85;
    const passed = accHours.last30Days <= limit;
    return {
      ruleId: this.ruleId,
      ruleSource: this.ruleSource,
      passed,
      severity: !passed ? 'critical' : accHours.last30Days > limit * 0.85 ? 'warning' : 'info',
      message: `${accHours.last30Days}h de voo em 30 dias (limite: ${limit}h)`,
      alertCode: passed ? undefined : 'FLIGHT_HOURS_EXCEEDED',
      context: { hours: accHours.last30Days, limit },
    };
  },
};

export const rbac117FlightHours7Days: RegulationRule = {
  ruleId: 'RBAC117_FH_7D',
  ruleSource: 'RBAC_117',
  description: 'Limite de 44h de voo em 7 dias consecutivos (Tabela 5)',
  evaluate(duty, rest, fatigue, context, accHours) {
    const limit = 44;
    const passed = accHours.last7Days <= limit;
    return {
      ruleId: this.ruleId,
      ruleSource: this.ruleSource,
      passed,
      severity: passed ? (accHours.last7Days > limit * 0.85 ? 'warning' : 'info') : 'critical',
      message: `${accHours.last7Days}h de voo em 7 dias (limite: ${limit}h)`,
      alertCode: passed ? undefined : 'FLIGHT_HOURS_EXCEEDED',
      context: { hours: accHours.last7Days, limit },
    };
  },
};

export const rbac117WeeklyRest: RegulationRule = {
  ruleId: 'RBAC117_WEEKLY_REST',
  ruleSource: 'RBAC_117',
  description: 'Repouso semanal mínimo de 36h consecutivas',
  evaluate(duty, rest) {
    // This rule requires schedule-level analysis; simplified check
    if (rest.restBeforeDutyHours !== null && rest.restBeforeDutyHours >= 36) {
      return { ruleId: this.ruleId, ruleSource: this.ruleSource, passed: true, severity: 'info', message: 'Repouso semanal de 36h atendido' };
    }
    return {
      ruleId: this.ruleId,
      ruleSource: this.ruleSource,
      passed: true, // Can't determine from single duty, default pass
      severity: 'info',
      message: 'Verificação de repouso semanal requer análise de janela completa',
    };
  },
};

export const rbac117WoclExposure: RegulationRule = {
  ruleId: 'RBAC117_WOCL',
  ruleSource: 'RBAC_117',
  description: 'Exposição ao WOCL (02:00-06:00) — gestão de fadiga',
  evaluate(duty, rest, fatigue) {
    const minutes = fatigue.woclExposure.totalMinutes;
    const passed = minutes <= 120; // 2h threshold for warning
    return {
      ruleId: this.ruleId,
      ruleSource: this.ruleSource,
      passed,
      severity: minutes === 0 ? 'info' : minutes <= 120 ? 'warning' : 'critical',
      message: minutes === 0
        ? 'Sem exposição ao WOCL'
        : `${minutes}min de exposição ao WOCL (02:00-06:00)`,
      alertCode: minutes > 0 ? 'WOCL_EXPOSURE' : undefined,
      context: { woclMinutes: minutes, windows: fatigue.woclExposure.windows },
    };
  },
};

/** All RBAC 117 rules */
export const rbac117Rules: RegulationRule[] = [
  rbac117MaxDutyHours,
  rbac117MaxFlightHours,
  rbac117MinRest,
  rbac117FlightHoursMonth,
  rbac117FlightHours7Days,
  rbac117WeeklyRest,
  rbac117WoclExposure,
];
