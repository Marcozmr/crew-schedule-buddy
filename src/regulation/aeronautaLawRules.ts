/**
 * EscalaX Regulation Engine — Lei 13.475 (Lei do Aeronauta)
 * 
 * Brazilian Aeronaut Law rules. These are the baseline legal requirements
 * that apply to all Brazilian aviation crew regardless of airline.
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

// ─── Lei 13.475 Constants ───

const MAX_DUTY_HOURS_ABSOLUTE = 14; // Art. 34 — absolute max duty
const MIN_DAYS_OFF_PER_MONTH = 8;   // Art. 34 § 5
const MAX_CONSECUTIVE_NIGHT_OPS = 2; // Art. 38

export const aeronautaMaxDutyAbsolute: RegulationRule = {
  ruleId: 'LEI13475_MAX_DUTY_ABSOLUTE',
  ruleSource: 'LEI_13475',
  description: 'Jornada máxima absoluta de 14h (Art. 34, Lei 13.475)',
  evaluate(duty) {
    const passed = duty.totalDutyHours <= MAX_DUTY_HOURS_ABSOLUTE;
    return {
      ruleId: this.ruleId,
      ruleSource: this.ruleSource,
      passed,
      severity: passed ? 'info' : 'critical',
      message: passed
        ? `Jornada ${duty.totalDutyHours}h dentro do limite absoluto de ${MAX_DUTY_HOURS_ABSOLUTE}h`
        : `Jornada ${duty.totalDutyHours}h excede o limite legal absoluto de ${MAX_DUTY_HOURS_ABSOLUTE}h`,
      alertCode: passed ? undefined : 'DUTY_EXCEEDED',
      context: { actualHours: duty.totalDutyHours, absoluteMax: MAX_DUTY_HOURS_ABSOLUTE },
    };
  },
};

export const aeronautaMinRest12h: RegulationRule = {
  ruleId: 'LEI13475_MIN_REST_12H',
  ruleSource: 'LEI_13475',
  description: 'Repouso mínimo legal de 12h consecutivas (Art. 40)',
  evaluate(duty, rest) {
    if (rest.restBeforeDutyHours === null) {
      return { ruleId: this.ruleId, ruleSource: this.ruleSource, passed: true, severity: 'info', message: 'Primeira jornada — sem repouso anterior' };
    }
    const passed = rest.restBeforeDutyHours >= 12;
    return {
      ruleId: this.ruleId,
      ruleSource: this.ruleSource,
      passed,
      severity: passed ? 'info' : 'critical',
      message: passed
        ? `Repouso de ${rest.restBeforeDutyHours}h atende ao mínimo legal de 12h`
        : `Repouso de ${rest.restBeforeDutyHours}h viola o mínimo legal de 12h`,
      alertCode: passed ? undefined : 'REST_INSUFFICIENT',
      context: { restHours: rest.restBeforeDutyHours },
    };
  },
};

export const aeronautaConsecutiveNightOps: RegulationRule = {
  ruleId: 'LEI13475_CONSECUTIVE_NIGHT',
  ruleSource: 'LEI_13475',
  description: 'Máximo de 2 madrugadas consecutivas (Art. 38)',
  evaluate(duty, rest, fatigue) {
    const count = fatigue.consecutiveNightDuties;
    const passed = count <= MAX_CONSECUTIVE_NIGHT_OPS;
    return {
      ruleId: this.ruleId,
      ruleSource: this.ruleSource,
      passed,
      severity: passed ? (count === MAX_CONSECUTIVE_NIGHT_OPS ? 'warning' : 'info') : 'critical',
      message: passed
        ? `${count} madrugada(s) consecutiva(s) (máx: ${MAX_CONSECUTIVE_NIGHT_OPS})`
        : `${count} madrugadas consecutivas excede o limite de ${MAX_CONSECUTIVE_NIGHT_OPS}`,
      alertCode: passed ? undefined : 'MADRUGADA_LIMIT_EXCEEDED',
      context: { consecutiveNights: count, limit: MAX_CONSECUTIVE_NIGHT_OPS },
    };
  },
};

export const aeronautaConsecutiveEarlyStarts: RegulationRule = {
  ruleId: 'LEI13475_CONSECUTIVE_EARLY',
  ruleSource: 'LEI_13475',
  description: 'Alerta para apresentações consecutivas antes das 06:00',
  evaluate(duty, rest, fatigue) {
    const count = fatigue.consecutiveEarlyStarts;
    const passed = count <= 3;
    return {
      ruleId: this.ruleId,
      ruleSource: this.ruleSource,
      passed,
      severity: count <= 2 ? 'info' : count <= 3 ? 'warning' : 'critical',
      message: `${count} apresentação(ões) consecutiva(s) antes das 06:00`,
      alertCode: count > 2 ? 'CONSECUTIVE_EARLY_STARTS' : undefined,
      context: { consecutiveEarlyStarts: count },
    };
  },
};

export const aeronautaFlightHoursYear: RegulationRule = {
  ruleId: 'LEI13475_FH_YEAR',
  ruleSource: 'LEI_13475',
  description: 'Limite anual de horas de voo (Art. 30)',
  evaluate(duty, rest, fatigue, context, accHours) {
    // General limit: 1000h/year (widebody) or 900h/year (narrowbody)
    const limit = context.crew.aircraftCategory === 'widebody' ? 1000 : 900;
    const passed = accHours.last365Days <= limit;
    return {
      ruleId: this.ruleId,
      ruleSource: this.ruleSource,
      passed,
      severity: !passed ? 'critical' : accHours.last365Days > limit * 0.90 ? 'warning' : 'info',
      message: `${accHours.last365Days}h de voo em 365 dias (limite: ${limit}h — ${context.crew.aircraftCategory})`,
      alertCode: passed ? undefined : 'FLIGHT_HOURS_EXCEEDED',
      context: { hours: accHours.last365Days, limit, category: context.crew.aircraftCategory },
    };
  },
};

/** All Lei 13.475 rules */
export const aeronautaLawRules: RegulationRule[] = [
  aeronautaMaxDutyAbsolute,
  aeronautaMinRest12h,
  aeronautaConsecutiveNightOps,
  aeronautaConsecutiveEarlyStarts,
  aeronautaFlightHoursYear,
];
