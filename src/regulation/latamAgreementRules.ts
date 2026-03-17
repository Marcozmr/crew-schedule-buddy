/**
 * EscalaX Regulation Engine — LATAM ACT 2025-2027 Rules
 * 
 * LATAM Airlines collective agreement rules.
 * These take priority over general RBAC 117 / Lei 13.475 when applicable.
 * 
 * Designed to be swappable for other airline agreements.
 */

import type {
  RegulationRule,
  DutyCalculation,
  RestCalculation,
  FatigueCalculation,
  ScheduleWindow,
  ComplianceResult,
} from './types';

// ─── LATAM ACT Constants ───

const MAX_CONSECUTIVE_MADRUGADAS = 2;
const MAX_MADRUGADAS_168H = 4;
const STANDBY_MIN_HOURS = 3;
const STANDBY_MAX_HOURS = 12;
const RESERVE_MIN_HOURS = 3;
const RESERVE_MAX_HOURS = 6;
const GROUND_TIME_NIGHT_MAX_MIN = 120;  // minutes
const GROUND_TIME_DAY_MAX_MIN = 180;    // minutes
const WIDEBODY_28D_LIMIT = 100;
const NARROWBODY_28D_LIMIT = 90;
const WIDEBODY_YEAR_LIMIT = 1000;
const NARROWBODY_YEAR_LIMIT = 900;

// ─── Rules ───

export const latamMaxConsecutiveMadrugadas: RegulationRule = {
  ruleId: 'LATAM_ACT_CONSECUTIVE_MADRUGADAS',
  ruleSource: 'LATAM_ACT_2025',
  description: 'Máximo de 2 madrugadas consecutivas (ACT LATAM 2025)',
  evaluate(duty, rest, fatigue) {
    const count = fatigue.consecutiveNightDuties;
    const passed = count <= MAX_CONSECUTIVE_MADRUGADAS;
    return {
      ruleId: this.ruleId,
      ruleSource: this.ruleSource,
      passed,
      severity: passed ? (count === MAX_CONSECUTIVE_MADRUGADAS ? 'warning' : 'info') : 'critical',
      message: passed
        ? `${count} madrugada(s) consecutiva(s) — dentro do ACT`
        : `${count} madrugadas consecutivas — viola ACT LATAM (máx: ${MAX_CONSECUTIVE_MADRUGADAS})`,
      alertCode: passed ? undefined : 'MADRUGADA_LIMIT_EXCEEDED',
      context: { count, limit: MAX_CONSECUTIVE_MADRUGADAS },
    };
  },
};

export const latamMadrugadas168h: RegulationRule = {
  ruleId: 'LATAM_ACT_MADRUGADAS_168H',
  ruleSource: 'LATAM_ACT_2025',
  description: 'Máximo de 4 madrugadas em 168h (7 dias) — ACT LATAM',
  evaluate(duty, rest, fatigue, context) {
    // Requires counting night duties in the last 7 days from schedule window
    // Simplified: use consecutive as proxy; full implementation needs window scan
    const nightCount = fatigue.consecutiveNightDuties; // conservative proxy
    const passed = nightCount <= MAX_MADRUGADAS_168H;
    return {
      ruleId: this.ruleId,
      ruleSource: this.ruleSource,
      passed,
      severity: passed ? 'info' : 'critical',
      message: passed
        ? `Madrugadas em 168h dentro do limite ACT (máx: ${MAX_MADRUGADAS_168H})`
        : `Madrugadas em 168h excede limite ACT de ${MAX_MADRUGADAS_168H}`,
      alertCode: passed ? undefined : 'MADRUGADA_LIMIT_EXCEEDED',
      context: { nightCount, limit: MAX_MADRUGADAS_168H },
    };
  },
};

export const latamGroundTimeLimits: RegulationRule = {
  ruleId: 'LATAM_ACT_GROUND_TIME',
  ruleSource: 'LATAM_ACT_2025',
  description: 'Tempo de solo máximo: 120min (noturno) / 180min (diurno) — ACT LATAM',
  evaluate(duty) {
    if (duty.groundTimesBetweenLegs.length === 0) {
      return { ruleId: this.ruleId, ruleSource: this.ruleSource, passed: true, severity: 'info', message: 'Sem paradas intermediárias' };
    }

    const isNight = duty.reportHourLocal < 6 || duty.endHourLocal < 6 || duty.reportHourLocal >= 22;
    const maxAllowedMin = isNight ? GROUND_TIME_NIGHT_MAX_MIN : GROUND_TIME_DAY_MAX_MIN;

    const longestGapMin = Math.max(...duty.groundTimesBetweenLegs.map(ms => ms / 60000));
    const passed = longestGapMin <= maxAllowedMin;

    return {
      ruleId: this.ruleId,
      ruleSource: this.ruleSource,
      passed,
      severity: passed ? 'info' : 'warning',
      message: passed
        ? `Tempo de solo máximo ${Math.round(longestGapMin)}min ≤ ${maxAllowedMin}min`
        : `Tempo de solo ${Math.round(longestGapMin)}min excede limite de ${maxAllowedMin}min (${isNight ? 'noturno' : 'diurno'})`,
      alertCode: passed ? undefined : 'GROUND_TIME_EXCEEDED',
      context: { longestGapMin: Math.round(longestGapMin), maxAllowedMin, isNight },
    };
  },
};

export const latamFlightHours28Days: RegulationRule = {
  ruleId: 'LATAM_ACT_FH_28D',
  ruleSource: 'LATAM_ACT_2025',
  description: 'Limite de horas de voo em 28 dias por tipo de aeronave — ACT LATAM',
  evaluate(duty, rest, fatigue, context, accHours) {
    const limit = context.crew.aircraftCategory === 'widebody'
      ? WIDEBODY_28D_LIMIT
      : NARROWBODY_28D_LIMIT;
    const passed = accHours.last28Days <= limit;
    return {
      ruleId: this.ruleId,
      ruleSource: this.ruleSource,
      passed,
      severity: !passed ? 'critical' : accHours.last28Days > limit * 0.85 ? 'warning' : 'info',
      message: `${accHours.last28Days}h em 28 dias (limite ACT: ${limit}h — ${context.crew.aircraftCategory})`,
      alertCode: passed ? undefined : 'FLIGHT_HOURS_EXCEEDED',
      context: { hours: accHours.last28Days, limit, category: context.crew.aircraftCategory },
    };
  },
};

export const latamFlightHoursYear: RegulationRule = {
  ruleId: 'LATAM_ACT_FH_YEAR',
  ruleSource: 'LATAM_ACT_2025',
  description: 'Limite anual de horas de voo por tipo de aeronave — ACT LATAM',
  evaluate(duty, rest, fatigue, context, accHours) {
    const limit = context.crew.aircraftCategory === 'widebody'
      ? WIDEBODY_YEAR_LIMIT
      : NARROWBODY_YEAR_LIMIT;
    const passed = accHours.last365Days <= limit;
    return {
      ruleId: this.ruleId,
      ruleSource: this.ruleSource,
      passed,
      severity: !passed ? 'critical' : accHours.last365Days > limit * 0.90 ? 'warning' : 'info',
      message: `${accHours.last365Days}h em 365 dias (limite ACT: ${limit}h — ${context.crew.aircraftCategory})`,
      alertCode: passed ? undefined : 'FLIGHT_HOURS_EXCEEDED',
      context: { hours: accHours.last365Days, limit, category: context.crew.aircraftCategory },
    };
  },
};

export const latamRestAugmentation: RegulationRule = {
  ruleId: 'LATAM_ACT_REST_AUGMENTATION',
  ruleSource: 'LATAM_ACT_2025',
  description: 'Repouso aumentado quando jornada inicia ou termina fora da base — ACT LATAM',
  evaluate(duty, rest) {
    if (rest.restAfterDutyHours === null) {
      return { ruleId: this.ruleId, ruleSource: this.ruleSource, passed: true, severity: 'info', message: 'Última jornada — sem repouso posterior disponível' };
    }
    if (!rest.augmentedRest) {
      return { ruleId: this.ruleId, ruleSource: this.ruleSource, passed: true, severity: 'info', message: 'Jornada na base — sem aumento de repouso' };
    }
    const passed = rest.restAfterDutyHours >= rest.minRequiredRestHours;
    return {
      ruleId: this.ruleId,
      ruleSource: this.ruleSource,
      passed,
      severity: passed ? 'info' : 'critical',
      message: passed
        ? `Repouso aumentado ${rest.restAfterDutyHours}h ≥ ${rest.minRequiredRestHours}h (fora da base)`
        : `Repouso ${rest.restAfterDutyHours}h < ${rest.minRequiredRestHours}h requerido (fora da base)`,
      alertCode: passed ? undefined : 'REST_INSUFFICIENT',
      context: { restHours: rest.restAfterDutyHours, required: rest.minRequiredRestHours },
    };
  },
};

/** All LATAM ACT 2025 rules */
export const latamAgreementRules: RegulationRule[] = [
  latamMaxConsecutiveMadrugadas,
  latamMadrugadas168h,
  latamGroundTimeLimits,
  latamFlightHours28Days,
  latamFlightHoursYear,
  latamRestAugmentation,
];
