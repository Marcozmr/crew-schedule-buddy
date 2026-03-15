// RBAC 117 Apêndice B - Compliance Engine
// Based on the official SNA guide for fatigue risk management

export interface ComplianceResult {
  status: 'regular' | 'atencao' | 'irregular';
  label: string;
  alerts: ComplianceAlert[];
  maxDutyHours: number;
  maxFlightHours: number;
  minRestHours: number;
  accumulatedHoursMonth: number;
  accumulatedHours7Days: number;
  accumulatedHours28Days: number;
  nightOpsCount: number;
  daysOffCount: number;
}

export interface ComplianceAlert {
  type: 'danger' | 'warning' | 'info';
  title: string;
  description: string;
  reference: string;
}

interface ScheduleEntry {
  date: string;
  departure_time: string;
  arrival_time: string;
  duty_hours: number | null;
  flight_number: string;
  departure: string;
  arrival: string;
  report_time: string | null;
}

// Table 1 - RBAC 117 Apêndice B: Limite de jornada e tempo de voo para tripulação simples
// [startHour range]: { legs: [maxDuty, maxFlight] }
const DUTY_TABLE: Record<string, Record<string, [number, number]>> = {
  '06-06': { '1-2': [11, 9], '3-4': [11, 9], '5': [10, 8], '6': [9, 8], '7+': [9, 8] },
  '07-07': { '1-2': [12, 9.5], '3-4': [12, 9], '5': [11, 9], '6': [10, 8], '7+': [9, 8] },
  '08-11': { '1-2': [12, 10], '3-4': [12, 9.5], '5': [12, 9], '6': [11, 9], '7+': [10, 8] },
  '12-13': { '1-2': [12, 9.5], '3-4': [12, 9], '5': [11, 9], '6': [10, 8], '7+': [9, 8] },
  '14-15': { '1-2': [11, 9], '3-4': [11, 9], '5': [10, 8], '6': [9, 8], '7+': [9, 8] },
  '16-17': { '1-2': [10, 8], '3-4': [10, 8], '5': [9, 8], '6': [9, 8], '7+': [9, 8] },
  '18-05': { '1-2': [9, 8], '3-4': [9, 8], '5': [9, 7], '6': [9, 7], '7+': [9, 7] },
};

// Cumulative limits (Table 5)
const LIMITS = {
  MAX_FLIGHT_HOURS_24H: 9,
  MAX_DUTY_HOURS_24H: 12,
  MAX_FLIGHT_HOURS_7D: 44,
  MAX_DUTY_HOURS_7D: 60,
  MAX_FLIGHT_HOURS_28D: 100,
  MAX_DUTY_HOURS_28D: 176,
  MAX_FLIGHT_HOURS_365D: 1000,
  MAX_DUTY_HOURS_MONTH: 85,
  MIN_REST_ACCLIMATED: 12,
  MIN_REST_HOTEL: 10, // 8h sleep + 2h hygiene
  MAX_CONSECUTIVE_NIGHT_OPS: 2,
  MAX_NIGHT_OPS_168H: 4,
  MIN_DAYS_OFF_MONTH: 8,
};

function getHourFromTime(time: string): number {
  const [h] = time.split(':').map(Number);
  return h;
}

function getTimeRangeKey(hour: number): string {
  if (hour >= 6 && hour <= 6) return '06-06';
  if (hour >= 7 && hour <= 7) return '07-07';
  if (hour >= 8 && hour <= 11) return '08-11';
  if (hour >= 12 && hour <= 13) return '12-13';
  if (hour >= 14 && hour <= 15) return '14-15';
  if (hour >= 16 && hour <= 17) return '16-17';
  return '18-05'; // 18:00 - 05:59
}

function getLegsKey(legs: number): string {
  if (legs <= 2) return '1-2';
  if (legs <= 4) return '3-4';
  if (legs === 5) return '5';
  if (legs === 6) return '6';
  return '7+';
}

function isNightOp(departureTime: string, arrivalTime: string): boolean {
  const depH = getHourFromTime(departureTime);
  const arrH = getHourFromTime(arrivalTime);
  // Night operation: any part between 00:00 and 06:00
  return depH < 6 || arrH < 6 || depH >= 0 && depH < 6;
}

function parseDate(dateStr: string): Date {
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length < 3) return new Date();
  return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
}

export function checkCompliance(
  schedule: ScheduleEntry[],
  currentDate: Date = new Date()
): ComplianceResult {
  const alerts: ComplianceAlert[] = [];

  const now = currentDate;
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Filter entries for current month
  const monthEntries = schedule.filter(e => {
    const d = parseDate(e.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  // Sort by date
  const sorted = [...monthEntries].sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());

  // Calculate accumulated hours
  const totalFlightHours = sorted.reduce((sum, e) => sum + (e.duty_hours || 0), 0);
  const totalDutyHours = totalFlightHours * 1.2; // Approximate duty = flight * 1.2

  // Days with flights
  const flightDates = new Set(sorted.map(e => e.date));
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysOff = daysInMonth - flightDates.size;

  // Count night ops
  let nightOpsCount = 0;
  let consecutiveNightOps = 0;
  let maxConsecutiveNight = 0;

  sorted.forEach((entry, i) => {
    const isNight = isNightOp(entry.departure_time, entry.arrival_time);
    if (isNight) {
      nightOpsCount++;
      consecutiveNightOps++;
      maxConsecutiveNight = Math.max(maxConsecutiveNight, consecutiveNightOps);
    } else {
      consecutiveNightOps = 0;
    }
  });

  // 7-day window
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const entries7d = schedule.filter(e => {
    const d = parseDate(e.date);
    return d >= sevenDaysAgo && d <= now;
  });
  const hours7d = entries7d.reduce((sum, e) => sum + (e.duty_hours || 0), 0);

  // 28-day window
  const twentyEightDaysAgo = new Date(now);
  twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
  const entries28d = schedule.filter(e => {
    const d = parseDate(e.date);
    return d >= twentyEightDaysAgo && d <= now;
  });
  const hours28d = entries28d.reduce((sum, e) => sum + (e.duty_hours || 0), 0);

  // Get max duty/flight for typical day
  const startHour = sorted.length > 0 ? getHourFromTime(sorted[0].report_time || sorted[0].departure_time) : 8;
  const legsPerDay = Math.ceil(sorted.length / Math.max(flightDates.size, 1));
  const timeKey = getTimeRangeKey(startHour);
  const legsKey = getLegsKey(legsPerDay);
  const dutyLimits = DUTY_TABLE[timeKey]?.[legsKey] || [12, 9];

  // ===== COMPLIANCE CHECKS =====

  // 1. Monthly flight hours limit (85h)
  if (totalFlightHours > LIMITS.MAX_DUTY_HOURS_MONTH) {
    alerts.push({
      type: 'danger',
      title: 'Limite mensal de horas excedido',
      description: `${totalFlightHours.toFixed(1)}h voadas — máximo permitido: ${LIMITS.MAX_DUTY_HOURS_MONTH}h`,
      reference: 'RBAC 117, Apêndice B, Tabela 5',
    });
  } else if (totalFlightHours > LIMITS.MAX_DUTY_HOURS_MONTH * 0.85) {
    alerts.push({
      type: 'warning',
      title: 'Próximo do limite mensal',
      description: `${totalFlightHours.toFixed(1)}h voadas de ${LIMITS.MAX_DUTY_HOURS_MONTH}h permitidas (${Math.round((totalFlightHours / LIMITS.MAX_DUTY_HOURS_MONTH) * 100)}%)`,
      reference: 'RBAC 117, Apêndice B, Tabela 5',
    });
  }

  // 2. 7-day limit (44h flight)
  if (hours7d > LIMITS.MAX_FLIGHT_HOURS_7D) {
    alerts.push({
      type: 'danger',
      title: 'Limite de 7 dias excedido',
      description: `${hours7d.toFixed(1)}h em 7 dias — máximo: ${LIMITS.MAX_FLIGHT_HOURS_7D}h`,
      reference: 'RBAC 117, Apêndice B, Tabela 5',
    });
  } else if (hours7d > LIMITS.MAX_FLIGHT_HOURS_7D * 0.85) {
    alerts.push({
      type: 'warning',
      title: 'Próximo do limite de 7 dias',
      description: `${hours7d.toFixed(1)}h em 7 dias de ${LIMITS.MAX_FLIGHT_HOURS_7D}h permitidas`,
      reference: 'RBAC 117, Apêndice B, Tabela 5',
    });
  }

  // 3. 28-day limit (100h flight)
  if (hours28d > LIMITS.MAX_FLIGHT_HOURS_28D) {
    alerts.push({
      type: 'danger',
      title: 'Limite de 28 dias excedido',
      description: `${hours28d.toFixed(1)}h em 28 dias — máximo: ${LIMITS.MAX_FLIGHT_HOURS_28D}h`,
      reference: 'RBAC 117, Apêndice B, Tabela 5',
    });
  }

  // 4. Minimum days off (8 per month)
  if (daysOff < LIMITS.MIN_DAYS_OFF_MONTH) {
    alerts.push({
      type: 'danger',
      title: 'Folgas insuficientes',
      description: `${daysOff} folgas no mês — mínimo obrigatório: ${LIMITS.MIN_DAYS_OFF_MONTH}`,
      reference: 'RBAC 117, Apêndice B — Folgas periódicas',
    });
  } else if (daysOff <= LIMITS.MIN_DAYS_OFF_MONTH + 1) {
    alerts.push({
      type: 'warning',
      title: 'Poucas folgas restantes',
      description: `${daysOff} folgas no mês — mínimo: ${LIMITS.MIN_DAYS_OFF_MONTH}`,
      reference: 'RBAC 117, Apêndice B — Folgas periódicas',
    });
  }

  // 5. Consecutive night operations
  if (maxConsecutiveNight > LIMITS.MAX_CONSECUTIVE_NIGHT_OPS) {
    alerts.push({
      type: 'danger',
      title: 'Madrugadas consecutivas excedidas',
      description: `${maxConsecutiveNight} madrugadas consecutivas — máximo: ${LIMITS.MAX_CONSECUTIVE_NIGHT_OPS}`,
      reference: 'RBAC 117, Apêndice B, item (o)',
    });
  }

  // 6. Check rest between flights
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevDate = parseDate(prev.date);
    const currDate = parseDate(curr.date);

    const [prevArrH, prevArrM] = prev.arrival_time.split(':').map(Number);
    const [currDepH, currDepM] = (curr.report_time || curr.departure_time).split(':').map(Number);

    const prevEnd = prevDate.getTime() + (prevArrH * 60 + prevArrM + 30) * 60000; // +30min post-flight
    const currStart = currDate.getTime() + (currDepH * 60 + currDepM) * 60000;
    const restHours = (currStart - prevEnd) / 3600000;

    if (restHours > 0 && restHours < LIMITS.MIN_REST_ACCLIMATED) {
      alerts.push({
        type: 'danger',
        title: `Repouso insuficiente (${prev.date} → ${curr.date})`,
        description: `${restHours.toFixed(1)}h de repouso — mínimo: ${LIMITS.MIN_REST_ACCLIMATED}h`,
        reference: 'RBAC 117, Apêndice B, Tabela 6',
      });
    }
  }

  // Determine overall status
  const hasDanger = alerts.some(a => a.type === 'danger');
  const hasWarning = alerts.some(a => a.type === 'warning');

  let status: ComplianceResult['status'] = 'regular';
  let label = 'Regular';
  if (hasDanger) {
    status = 'irregular';
    label = 'Irregular';
  } else if (hasWarning) {
    status = 'atencao';
    label = 'Atenção';
  }

  return {
    status,
    label,
    alerts,
    maxDutyHours: dutyLimits[0],
    maxFlightHours: dutyLimits[1],
    minRestHours: LIMITS.MIN_REST_ACCLIMATED,
    accumulatedHoursMonth: totalFlightHours,
    accumulatedHours7Days: hours7d,
    accumulatedHours28Days: hours28d,
    nightOpsCount,
    daysOffCount: daysOff,
  };
}
