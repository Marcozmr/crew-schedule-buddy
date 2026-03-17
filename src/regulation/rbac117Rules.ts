/**
 * EscalaX Regulation Engine — RBAC 117 Rules
 * 
 * Brazilian ANAC RBAC 117 fatigue regulation rules.
 * Each rule is independent and returns a deterministic RuleResult with
 * calculatedValue and limitUsed for auditability.
 */

import type {
  RegulationRule,
  DutyCalculation,
  RestCalculation,
  FatigueCalculation,
  ScheduleWindow,
  ComplianceResult,
} from './types';

// ─── RBAC 117 Duty Time Table (Appendix B, Table 4) ───
// Format: [maxDutyHours, maxFlightHours]

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
  evaluate(duty) {
    const { maxDuty } = getDutyLimits(duty.reportHourLocal, duty.sectorCount);
    const passed = duty.totalDutyHours <= maxDuty;
    return {
      ruleId: this.ruleId, ruleSource: this.ruleSource, passed,
      severity: passed ? 'info' : 'critical',
      message: passed
        ? `Jornada ${duty.totalDutyHours}h dentro do limite de ${maxDuty}h`
        : `Jornada ${duty.totalDutyHours}h excede o limite de ${maxDuty}h`,
      alertCode: passed ? undefined : 'DUTY_EXCEEDED',
      calculatedValue: duty.totalDutyHours, limitUsed: maxDuty,
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
      ruleId: this.ruleId, ruleSource: this.ruleSource, passed,
      severity: passed ? 'info' : 'critical',
      message: passed
        ? `Voo ${duty.totalFlightHours}h dentro do limite de ${maxFlight}h`
        : `Voo ${duty.totalFlightHours}h excede o limite de ${maxFlight}h`,
      alertCode: passed ? undefined : 'FLIGHT_HOURS_EXCEEDED',
      calculatedValue: duty.totalFlightHours, limitUsed: maxFlight,
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
      ruleId: this.ruleId, ruleSource: this.ruleSource, passed,
      severity: passed ? 'info' : 'critical',
      message: passed
        ? `Repouso ${rest.restBeforeDutyHours}h ≥ mínimo ${rest.minRequiredRestHours}h`
        : `Repouso ${rest.restBeforeDutyHours}h < mínimo ${rest.minRequiredRestHours}h`,
      alertCode: passed ? undefined : 'REST_INSUFFICIENT',
      calculatedValue: rest.restBeforeDutyHours, limitUsed: rest.minRequiredRestHours,
      context: { restHours: rest.restBeforeDutyHours, minRequired: rest.minRequiredRestHours, augmented: rest.augmentedRest },
    };
  },
};

export const rbac117FlightHoursMonth: RegulationRule = {
  ruleId: 'RBAC117_FH_MONTH',
  ruleSource: 'RBAC_117',
  description: 'Limite de 85h de voo em 30 dias (Tabela 5, Apêndice B)',
  evaluate(_duty, _rest, _fatigue, _context, accHours) {
    const limit = 85;
    const passed = accHours.last30Days <= limit;
    return {
      ruleId: this.ruleId, ruleSource: this.ruleSource, passed,
      severity: !passed ? 'critical' : accHours.last30Days > limit * 0.85 ? 'warning' : 'info',
      message: `${accHours.last30Days}h de voo em 30 dias (limite: ${limit}h)`,
      alertCode: passed ? undefined : 'FLIGHT_HOURS_EXCEEDED',
      calculatedValue: accHours.last30Days, limitUsed: limit,
      context: { hours: accHours.last30Days, limit },
    };
  },
};

export const rbac117FlightHours7Days: RegulationRule = {
  ruleId: 'RBAC117_FH_7D',
  ruleSource: 'RBAC_117',
  description: 'Limite de 44h de voo em 7 dias consecutivos (Tabela 5)',
  evaluate(_duty, _rest, _fatigue, _context, accHours) {
    const limit = 44;
    const passed = accHours.last7Days <= limit;
    return {
      ruleId: this.ruleId, ruleSource: this.ruleSource, passed,
      severity: passed ? (accHours.last7Days > limit * 0.85 ? 'warning' : 'info') : 'critical',
      message: `${accHours.last7Days}h de voo em 7 dias (limite: ${limit}h)`,
      alertCode: passed ? undefined : 'FLIGHT_HOURS_EXCEEDED',
      calculatedValue: accHours.last7Days, limitUsed: limit,
      context: { hours: accHours.last7Days, limit },
    };
  },
};

export const rbac117FlightHours90Days: RegulationRule = {
  ruleId: 'RBAC117_FH_90D',
  ruleSource: 'RBAC_117',
  description: 'Limite de 230h de voo em 90 dias consecutivos (Tabela 5)',
  evaluate(_duty, _rest, _fatigue, _context, accHours) {
    const limit = 230;
    const val = accHours.last90Days ?? 0;
    const passed = val <= limit;
    return {
      ruleId: this.ruleId, ruleSource: this.ruleSource, passed,
      severity: !passed ? 'critical' : val > limit * 0.85 ? 'warning' : 'info',
      message: `${val}h de voo em 90 dias (limite: ${limit}h)`,
      alertCode: passed ? undefined : 'FLIGHT_HOURS_EXCEEDED',
      calculatedValue: val, limitUsed: limit,
      context: { hours: val, limit },
    };
  },
};

export const rbac117FlightHours365Days: RegulationRule = {
  ruleId: 'RBAC117_FH_365D',
  ruleSource: 'RBAC_117',
  description: 'Limite de 850h de voo em 365 dias (Tabela 5, RBAC 117)',
  evaluate(_duty, _rest, _fatigue, _context, accHours) {
    const limit = 850;
    const passed = accHours.last365Days <= limit;
    return {
      ruleId: this.ruleId, ruleSource: this.ruleSource, passed,
      severity: !passed ? 'critical' : accHours.last365Days > limit * 0.90 ? 'warning' : 'info',
      message: `${accHours.last365Days}h de voo em 365 dias (limite RBAC: ${limit}h)`,
      alertCode: passed ? undefined : 'FLIGHT_HOURS_EXCEEDED',
      calculatedValue: accHours.last365Days, limitUsed: limit,
      context: { hours: accHours.last365Days, limit },
    };
  },
};


  ruleId: 'RBAC117_WEEKLY_REST',
  ruleSource: 'RBAC_117',
  description: 'Repouso semanal mínimo de 36h consecutivas em cada 7 dias',
  evaluate(_duty, _rest, _fatigue, context) {
    // Scan all duty periods in the window to find max consecutive rest gap
    const tz = context.crew.timezone || 'America/Sao_Paulo';
    const dutyPeriods = context.dutyPeriods;

    if (dutyPeriods.length < 2) {
      return { ruleId: this.ruleId, ruleSource: this.ruleSource, passed: true, severity: 'info', message: 'Dados insuficientes para verificar repouso semanal' };
    }

    // Sort duties by report time
    const sorted = [...dutyPeriods].sort((a, b) =>
      new Date(a.reportTimeUtc).getTime() - new Date(b.reportTimeUtc).getTime()
    );

    // Calculate end times (last leg arrival + 30min debrief)
    let maxRestHours = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const legs = sorted[i].legs.filter(l => l.activityType === 'flight' || l.activityType === 'positioning');
      const lastArrival = legs.length > 0
        ? Math.max(...legs.map(l => new Date(l.actualArrivalUtc || l.scheduledArrivalUtc).getTime()))
        : new Date(sorted[i].reportTimeUtc).getTime() + 3600000;
      const endMs = lastArrival + 30 * 60000;
      const nextReportMs = new Date(sorted[i + 1].reportTimeUtc).getTime();
      const restHours = (nextReportMs - endMs) / 3600000;
      if (restHours > maxRestHours) maxRestHours = restHours;
    }

    const limit = 36;
    const passed = maxRestHours >= limit;

    return {
      ruleId: this.ruleId, ruleSource: this.ruleSource, passed,
      severity: passed ? 'info' : 'critical',
      message: passed
        ? `Repouso semanal máximo encontrado: ${Math.round(maxRestHours * 10) / 10}h ≥ ${limit}h`
        : `Nenhum repouso ≥ ${limit}h encontrado na janela (máx: ${Math.round(maxRestHours * 10) / 10}h)`,
      alertCode: passed ? undefined : 'WEEKLY_REST_INSUFFICIENT',
      calculatedValue: Math.round(maxRestHours * 10) / 10, limitUsed: limit,
      context: { maxRestHours: Math.round(maxRestHours * 10) / 10, required: limit },
    };
  },
};

export const rbac117WoclExposure: RegulationRule = {
  ruleId: 'RBAC117_WOCL',
  ruleSource: 'RBAC_117',
  description: 'Exposição ao WOCL (02:00-06:00) — gestão de fadiga',
  evaluate(duty, _rest, fatigue) {
    const minutes = fatigue.woclExposure.totalMinutes;
    const passed = minutes <= 120;
    return {
      ruleId: this.ruleId, ruleSource: this.ruleSource, passed,
      severity: minutes === 0 ? 'info' : minutes <= 120 ? 'warning' : 'critical',
      message: minutes === 0
        ? 'Sem exposição ao WOCL'
        : `${minutes}min de exposição ao WOCL (02:00-06:00)`,
      alertCode: minutes > 0 ? 'WOCL_EXPOSURE' : undefined,
      calculatedValue: minutes, limitUsed: 120,
      context: { woclMinutes: minutes, dutyDiurno: duty.dutyTimeBreakdown.diurnoMinutes, dutyNoturno: duty.dutyTimeBreakdown.noturnoMinutes },
    };
  },
};

/** All RBAC 117 rules */
export const rbac117Rules: RegulationRule[] = [
  rbac117MaxDutyHours,
  rbac117MaxFlightHours,
  rbac117MinRest,
  rbac117FlightHours7Days,
  rbac117FlightHoursMonth,
  rbac117FlightHours90Days,
  rbac117FlightHours365Days,
  rbac117WeeklyRest,
  rbac117WoclExposure,
];
