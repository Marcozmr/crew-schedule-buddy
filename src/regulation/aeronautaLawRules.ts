/**
 * EscalaX Regulation Engine — Lei 13.475 (Lei do Aeronauta)
 * 
 * Brazilian Aeronaut Law rules with proper time segmentation.
 * Now uses isMadrugadaDuty from duty calculator (real 00:00-06:00 check).
 */

import type { RegulationRule } from './types';

const MAX_DUTY_HOURS_ABSOLUTE = 14; // Art. 34
const MAX_CONSECUTIVE_MADRUGADAS = 2; // Art. 38

export const aeronautaMaxDutyAbsolute: RegulationRule = {
  ruleId: 'LEI13475_MAX_DUTY_ABSOLUTE',
  ruleSource: 'LEI_13475',
  description: 'Jornada máxima absoluta de 14h (Art. 34, Lei 13.475)',
  evaluate(duty) {
    const passed = duty.totalDutyHours <= MAX_DUTY_HOURS_ABSOLUTE;
    return {
      ruleId: this.ruleId, ruleSource: this.ruleSource, passed,
      severity: passed ? 'info' : 'critical',
      message: passed
        ? `Jornada ${duty.totalDutyHours}h dentro do limite absoluto de ${MAX_DUTY_HOURS_ABSOLUTE}h`
        : `Jornada ${duty.totalDutyHours}h excede o limite legal absoluto de ${MAX_DUTY_HOURS_ABSOLUTE}h`,
      alertCode: passed ? undefined : 'DUTY_EXCEEDED',
      calculatedValue: duty.totalDutyHours, limitUsed: MAX_DUTY_HOURS_ABSOLUTE,
      context: {
        actualHours: duty.totalDutyHours,
        absoluteMax: MAX_DUTY_HOURS_ABSOLUTE,
        diurnoMinutes: duty.dutyTimeBreakdown.diurnoMinutes,
        noturnoMinutes: duty.dutyTimeBreakdown.noturnoMinutes,
      },
    };
  },
};

export const aeronautaMinRest12h: RegulationRule = {
  ruleId: 'LEI13475_MIN_REST_12H',
  ruleSource: 'LEI_13475',
  description: 'Repouso mínimo legal de 12h consecutivas (Art. 40)',
  evaluate(_duty, rest) {
    if (rest.restBeforeDutyHours === null) {
      return { ruleId: this.ruleId, ruleSource: this.ruleSource, passed: true, severity: 'info', message: 'Primeira jornada — sem repouso anterior' };
    }
    const limit = 12;
    const passed = rest.restBeforeDutyHours >= limit;
    return {
      ruleId: this.ruleId, ruleSource: this.ruleSource, passed,
      severity: passed ? 'info' : 'critical',
      message: passed
        ? `Repouso de ${rest.restBeforeDutyHours}h atende ao mínimo legal de ${limit}h`
        : `Repouso de ${rest.restBeforeDutyHours}h viola o mínimo legal de ${limit}h`,
      alertCode: passed ? undefined : 'REST_INSUFFICIENT',
      calculatedValue: rest.restBeforeDutyHours, limitUsed: limit,
      context: { restHours: rest.restBeforeDutyHours, restBreakdown: rest.restBeforeBreakdown },
    };
  },
};

export const aeronautaConsecutiveNightOps: RegulationRule = {
  ruleId: 'LEI13475_CONSECUTIVE_NIGHT',
  ruleSource: 'LEI_13475',
  description: 'Máximo de 2 madrugadas consecutivas (Art. 38)',
  evaluate(duty, _rest, fatigue) {
    const count = fatigue.consecutiveNightDuties;
    const passed = count <= MAX_CONSECUTIVE_MADRUGADAS;
    return {
      ruleId: this.ruleId, ruleSource: this.ruleSource, passed,
      severity: passed ? (count === MAX_CONSECUTIVE_MADRUGADAS ? 'warning' : 'info') : 'critical',
      message: passed
        ? `${count} madrugada(s) consecutiva(s) (máx: ${MAX_CONSECUTIVE_MADRUGADAS})`
        : `${count} madrugadas consecutivas excede o limite de ${MAX_CONSECUTIVE_MADRUGADAS}`,
      alertCode: passed ? undefined : 'MADRUGADA_LIMIT_EXCEEDED',
      calculatedValue: count, limitUsed: MAX_CONSECUTIVE_MADRUGADAS,
      context: {
        consecutiveMadrugadas: count,
        limit: MAX_CONSECUTIVE_MADRUGADAS,
        currentDutyMadrugadaMinutes: duty.dutyTimeBreakdown.madrugadaMinutes,
      },
    };
  },
};

export const aeronautaConsecutiveEarlyStarts: RegulationRule = {
  ruleId: 'LEI13475_CONSECUTIVE_EARLY',
  ruleSource: 'LEI_13475',
  description: 'Alerta para apresentações consecutivas antes das 06:00',
  evaluate(_duty, _rest, fatigue) {
    const count = fatigue.consecutiveEarlyStarts;
    const limit = 3;
    const passed = count <= limit;
    return {
      ruleId: this.ruleId, ruleSource: this.ruleSource, passed,
      severity: count <= 2 ? 'info' : count <= 3 ? 'warning' : 'critical',
      message: `${count} apresentação(ões) consecutiva(s) antes das 06:00`,
      alertCode: count > 2 ? 'CONSECUTIVE_EARLY_STARTS' : undefined,
      calculatedValue: count, limitUsed: limit,
      context: { consecutiveEarlyStarts: count },
    };
  },
};

export const aeronautaFlightHoursYear: RegulationRule = {
  ruleId: 'LEI13475_FH_YEAR',
  ruleSource: 'LEI_13475',
  description: 'Limite anual de horas de voo (Art. 30)',
  evaluate(_duty, _rest, _fatigue, context, accHours) {
    const limit = context.crew.aircraftCategory === 'widebody' ? 1000 : 900;
    const passed = accHours.last365Days <= limit;
    return {
      ruleId: this.ruleId, ruleSource: this.ruleSource, passed,
      severity: !passed ? 'critical' : accHours.last365Days > limit * 0.90 ? 'warning' : 'info',
      message: `${accHours.last365Days}h de voo em 365 dias (limite: ${limit}h — ${context.crew.aircraftCategory})`,
      alertCode: passed ? undefined : 'FLIGHT_HOURS_EXCEEDED',
      calculatedValue: accHours.last365Days, limitUsed: limit,
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
