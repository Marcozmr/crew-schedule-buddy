/**
 * EscalaX Regulation Engine — LATAM ACT 2025-2027 Rules
 * 
 * LATAM Airlines collective agreement rules.
 * Priority over RBAC 117 / Lei 13.475 when applicable.
 * 
 * FIXES:
 * - madrugadas168h now uses real count from fatigue calculator (not consecutive proxy)
 * - groundTimeLimits now classifies each gap individually using time segmentation
 */

import type { RegulationRule } from './types';

// ─── LATAM ACT Constants ───

const MAX_CONSECUTIVE_MADRUGADAS = 2;
const MAX_MADRUGADAS_168H = 4;
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
  evaluate(duty, _rest, fatigue) {
    const count = fatigue.consecutiveNightDuties;
    const passed = count <= MAX_CONSECUTIVE_MADRUGADAS;
    return {
      ruleId: this.ruleId, ruleSource: this.ruleSource, passed,
      severity: passed ? (count === MAX_CONSECUTIVE_MADRUGADAS ? 'warning' : 'info') : 'critical',
      message: passed
        ? `${count} madrugada(s) consecutiva(s) — dentro do ACT`
        : `${count} madrugadas consecutivas — viola ACT LATAM (máx: ${MAX_CONSECUTIVE_MADRUGADAS})`,
      alertCode: passed ? undefined : 'MADRUGADA_LIMIT_EXCEEDED',
      calculatedValue: count, limitUsed: MAX_CONSECUTIVE_MADRUGADAS,
      context: {
        count, limit: MAX_CONSECUTIVE_MADRUGADAS,
        madrugadaMinutes: duty.dutyTimeBreakdown.madrugadaMinutes,
      },
    };
  },
};

export const latamMadrugadas168h: RegulationRule = {
  ruleId: 'LATAM_ACT_MADRUGADAS_168H',
  ruleSource: 'LATAM_ACT_2025',
  description: 'Máximo de 4 madrugadas em 168h (7 dias) — ACT LATAM',
  evaluate(_duty, _rest, fatigue) {
    // Now uses real 168h count from fatigue calculator
    const nightCount = fatigue.madrugadasIn168h;
    const passed = nightCount <= MAX_MADRUGADAS_168H;
    return {
      ruleId: this.ruleId, ruleSource: this.ruleSource, passed,
      severity: passed ? (nightCount >= MAX_MADRUGADAS_168H ? 'warning' : 'info') : 'critical',
      message: passed
        ? `${nightCount} madrugada(s) em 168h — dentro do ACT (máx: ${MAX_MADRUGADAS_168H})`
        : `${nightCount} madrugadas em 168h excede limite ACT de ${MAX_MADRUGADAS_168H}`,
      alertCode: passed ? undefined : 'MADRUGADA_LIMIT_EXCEEDED',
      calculatedValue: nightCount, limitUsed: MAX_MADRUGADAS_168H,
      context: { nightCount, limit: MAX_MADRUGADAS_168H },
    };
  },
};

export const latamGroundTimeLimits: RegulationRule = {
  ruleId: 'LATAM_ACT_GROUND_TIME',
  ruleSource: 'LATAM_ACT_2025',
  description: 'Tempo de solo máximo: 120min (noturno) / 180min (diurno) — ACT LATAM',
  evaluate(duty) {
    const gaps = duty.groundGapDetails;
    if (!gaps || gaps.length === 0) {
      return { ruleId: this.ruleId, ruleSource: this.ruleSource, passed: true, severity: 'info', message: 'Sem paradas intermediárias' };
    }

    // Check each gap individually with proper day/night classification
    let worstViolation = 0;
    let worstGapIndex = -1;
    let worstIsNight = false;

    for (const gap of gaps) {
      const isNight = gap.isNightGap;
      const maxAllowedMin = isNight ? GROUND_TIME_NIGHT_MAX_MIN : GROUND_TIME_DAY_MAX_MIN;
      const excess = gap.totalMinutes - maxAllowedMin;

      if (excess > worstViolation) {
        worstViolation = excess;
        worstGapIndex = gap.gapIndex;
        worstIsNight = isNight;
      }
    }

    if (worstViolation <= 0) {
      const longestGap = Math.max(...gaps.map(g => g.totalMinutes));
      return {
        ruleId: this.ruleId, ruleSource: this.ruleSource, passed: true, severity: 'info',
        message: `Tempo de solo máximo ${longestGap}min — dentro dos limites`,
        calculatedValue: longestGap, limitUsed: GROUND_TIME_DAY_MAX_MIN,
        context: { gaps: gaps.map(g => ({ idx: g.gapIndex, min: g.totalMinutes, isNight: g.isNightGap, diurno: g.diurnoMinutes, noturno: g.noturnoMinutes })) },
      };
    }

    const violatingGap = gaps[worstGapIndex];
    const maxAllowed = worstIsNight ? GROUND_TIME_NIGHT_MAX_MIN : GROUND_TIME_DAY_MAX_MIN;

    return {
      ruleId: this.ruleId, ruleSource: this.ruleSource, passed: false,
      severity: 'warning',
      message: `Solo ${violatingGap.totalMinutes}min excede limite de ${maxAllowed}min (${worstIsNight ? 'noturno' : 'diurno'}) — parada #${worstGapIndex + 1}`,
      alertCode: 'GROUND_TIME_EXCEEDED',
      calculatedValue: violatingGap.totalMinutes, limitUsed: maxAllowed,
      context: {
        gapIndex: worstGapIndex,
        gapMinutes: violatingGap.totalMinutes,
        gapDiurno: violatingGap.diurnoMinutes,
        gapNoturno: violatingGap.noturnoMinutes,
        maxAllowed, isNight: worstIsNight,
      },
    };
  },
};

export const latamFlightHours28Days: RegulationRule = {
  ruleId: 'LATAM_ACT_FH_28D',
  ruleSource: 'LATAM_ACT_2025',
  description: 'Limite de horas de voo em 28 dias por tipo de aeronave — ACT LATAM',
  evaluate(_duty, _rest, _fatigue, context, accHours) {
    const limit = context.crew.aircraftCategory === 'widebody' ? WIDEBODY_28D_LIMIT : NARROWBODY_28D_LIMIT;
    const passed = accHours.last28Days <= limit;
    return {
      ruleId: this.ruleId, ruleSource: this.ruleSource, passed,
      severity: !passed ? 'critical' : accHours.last28Days > limit * 0.85 ? 'warning' : 'info',
      message: `${accHours.last28Days}h em 28 dias (limite ACT: ${limit}h — ${context.crew.aircraftCategory})`,
      alertCode: passed ? undefined : 'FLIGHT_HOURS_EXCEEDED',
      calculatedValue: accHours.last28Days, limitUsed: limit,
      context: { hours: accHours.last28Days, limit, category: context.crew.aircraftCategory },
    };
  },
};

export const latamFlightHoursYear: RegulationRule = {
  ruleId: 'LATAM_ACT_FH_YEAR',
  ruleSource: 'LATAM_ACT_2025',
  description: 'Limite anual de horas de voo por tipo de aeronave — ACT LATAM',
  evaluate(_duty, _rest, _fatigue, context, accHours) {
    const limit = context.crew.aircraftCategory === 'widebody' ? WIDEBODY_YEAR_LIMIT : NARROWBODY_YEAR_LIMIT;
    const passed = accHours.last365Days <= limit;
    return {
      ruleId: this.ruleId, ruleSource: this.ruleSource, passed,
      severity: !passed ? 'critical' : accHours.last365Days > limit * 0.90 ? 'warning' : 'info',
      message: `${accHours.last365Days}h em 365 dias (limite ACT: ${limit}h — ${context.crew.aircraftCategory})`,
      alertCode: passed ? undefined : 'FLIGHT_HOURS_EXCEEDED',
      calculatedValue: accHours.last365Days, limitUsed: limit,
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
      ruleId: this.ruleId, ruleSource: this.ruleSource, passed,
      severity: passed ? 'info' : 'critical',
      message: passed
        ? `Repouso aumentado ${rest.restAfterDutyHours}h ≥ ${rest.minRequiredRestHours}h (fora da base)`
        : `Repouso ${rest.restAfterDutyHours}h < ${rest.minRequiredRestHours}h requerido (fora da base)`,
      alertCode: passed ? undefined : 'REST_INSUFFICIENT',
      calculatedValue: rest.restAfterDutyHours, limitUsed: rest.minRequiredRestHours,
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
