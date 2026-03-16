// RBAC 117 Apêndice B - Compliance Engine
// All calculations use America/Sao_Paulo timezone (BRT/BRST)
// flight_hours for accumulation, activity_type for days off

import { TZDate } from '@date-fns/tz';

const BRAZIL_TZ = 'America/Sao_Paulo';

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
  flight_hours: number | null;
  flight_number: string;
  departure: string;
  arrival: string;
  report_time: string | null;
  activity_type: string;
  is_flight: boolean;
  crosses_midnight: boolean;
}

const DUTY_TABLE: Record<string, Record<string, [number, number]>> = {
  '06-06': { '1-2': [11, 9], '3-4': [11, 9], '5': [10, 8], '6': [9, 8], '7+': [9, 8] },
  '07-07': { '1-2': [12, 9.5], '3-4': [12, 9], '5': [11, 9], '6': [10, 8], '7+': [9, 8] },
  '08-11': { '1-2': [12, 10], '3-4': [12, 9.5], '5': [12, 9], '6': [11, 9], '7+': [10, 8] },
  '12-13': { '1-2': [12, 9.5], '3-4': [12, 9], '5': [11, 9], '6': [10, 8], '7+': [9, 8] },
  '14-15': { '1-2': [11, 9], '3-4': [11, 9], '5': [10, 8], '6': [9, 8], '7+': [9, 8] },
  '16-17': { '1-2': [10, 8], '3-4': [10, 8], '5': [9, 8], '6': [9, 8], '7+': [9, 8] },
  '18-05': { '1-2': [9, 8], '3-4': [9, 8], '5': [9, 7], '6': [9, 7], '7+': [9, 7] },
};

const LIMITS = {
  MAX_FLIGHT_HOURS_MONTH: 85,
  MAX_FLIGHT_HOURS_7D: 44,
  MAX_FLIGHT_HOURS_28D: 100,
  MIN_REST_ACCLIMATED: 12,
  MAX_CONSECUTIVE_NIGHT_OPS: 2,
  MIN_DAYS_OFF_MONTH: 8,
};

const DAY_OFF_CODES = new Set(['DO', 'FOLGA', 'OFF', 'X']);

// ─── Timezone helpers ───

/** Parse a date string (YYYY-MM-DD or DD/MM/YYYY) into a TZDate at midnight BRT */
function parseDateBRT(dateStr: string): TZDate {
  let year: number, month: number, day: number;
  if (dateStr.includes('-') && dateStr.indexOf('-') === 4) {
    [year, month, day] = dateStr.split('-').map(Number);
  } else {
    const parts = dateStr.split(/[\/\-]/);
    day = parseInt(parts[0]);
    month = parseInt(parts[1]);
    year = parseInt(parts[2]);
  }
  return new TZDate(year, month - 1, day, 0, 0, 0, BRAZIL_TZ);
}

/** Create a TZDate for a specific date + time (HH:MM) in BRT */
function toDateTimeBRT(dateStr: string, time: string): TZDate {
  const base = parseDateBRT(dateStr);
  const [h, m] = time.split(':').map(Number);
  return new TZDate(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, BRAZIL_TZ);
}

/** Get the arrival datetime in BRT, adding +1 day if arrival < departure (crosses midnight) */
function getArrivalDateTimeBRT(entry: ScheduleEntry): TZDate {
  const arr = toDateTimeBRT(entry.date, entry.arrival_time);
  const dep = toDateTimeBRT(entry.date, entry.departure_time);
  // If arrival time < departure time, the flight crossed midnight
  if (arr.getTime() <= dep.getTime()) {
    return new TZDate(arr.getFullYear(), arr.getMonth(), arr.getDate() + 1, arr.getHours(), arr.getMinutes(), 0, BRAZIL_TZ);
  }
  return arr;
}

function getHourBRT(time: string): number {
  return parseInt(time.split(':')[0]);
}

/** Night operation: any part of the flight between 00:00-05:59 BRT */
function isNightOp(entry: ScheduleEntry): boolean {
  if (!entry.is_flight) return false;
  const depH = getHourBRT(entry.departure_time);
  const arrDT = getArrivalDateTimeBRT(entry);
  const arrH = arrDT.getHours();
  // Night = departure or arrival in 00:00-05:59 BRT, or crosses midnight
  return depH < 6 || arrH < 6 || entry.crosses_midnight;
}

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

// ─── Main compliance check ───

export function checkCompliance(
  schedule: ScheduleEntry[],
  currentDate: Date = new Date()
): ComplianceResult {
  const alerts: ComplianceAlert[] = [];
  // Convert "now" to BRT
  const now = new TZDate(currentDate, BRAZIL_TZ);
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Filter entries for current month (in BRT)
  const monthEntries = schedule.filter(e => {
    const d = parseDateBRT(e.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const sorted = [...monthEntries].sort((a, b) => parseDateBRT(a.date).getTime() - parseDateBRT(b.date).getTime());

  // Flights only
  const monthFlights = sorted.filter(e => e.is_flight);
  const totalFlightHours = monthFlights.reduce((sum, e) => sum + (e.flight_hours || 0), 0);

  // Days off
  const daysOffFromSchedule = sorted.filter(e => DAY_OFF_CODES.has(e.activity_type)).length;
  const allDates = new Set(sorted.map(e => e.date));
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const unscheduledDays = Math.max(0, daysInMonth - allDates.size);
  const daysOff = daysOffFromSchedule + unscheduledDays;

  // Night ops
  let nightOpsCount = 0;
  let consecutiveNightOps = 0;
  let maxConsecutiveNight = 0;

  sorted.forEach(entry => {
    if (isNightOp(entry)) {
      nightOpsCount++;
      consecutiveNightOps++;
      maxConsecutiveNight = Math.max(maxConsecutiveNight, consecutiveNightOps);
    } else if (entry.is_flight) {
      consecutiveNightOps = 0;
    }
  });

  // 7-day window
  const sevenDaysAgo = new TZDate(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, BRAZIL_TZ);
  const flights7d = schedule.filter(e => {
    if (!e.is_flight) return false;
    const d = parseDateBRT(e.date);
    return d.getTime() >= sevenDaysAgo.getTime() && d.getTime() <= now.getTime();
  });
  const hours7d = flights7d.reduce((sum, e) => sum + (e.flight_hours || 0), 0);

  // 28-day window
  const twentyEightDaysAgo = new TZDate(now.getFullYear(), now.getMonth(), now.getDate() - 28, 0, 0, 0, BRAZIL_TZ);
  const flights28d = schedule.filter(e => {
    if (!e.is_flight) return false;
    const d = parseDateBRT(e.date);
    return d.getTime() >= twentyEightDaysAgo.getTime() && d.getTime() <= now.getTime();
  });
  const hours28d = flights28d.reduce((sum, e) => sum + (e.flight_hours || 0), 0);

  // Duty limits
  const flightDates = new Set(monthFlights.map(e => e.date));
  const startHour = monthFlights.length > 0 ? getHourBRT(monthFlights[0].report_time || monthFlights[0].departure_time) : 8;
  const legsPerDay = Math.ceil(monthFlights.length / Math.max(flightDates.size, 1));
  const dutyLimits = DUTY_TABLE[getTimeRangeKey(startHour)]?.[getLegsKey(legsPerDay)] || [12, 9];

  // ===== COMPLIANCE CHECKS =====

  // 1. Monthly flight hours (85h)
  if (totalFlightHours > LIMITS.MAX_FLIGHT_HOURS_MONTH) {
    alerts.push({ type: 'danger', title: 'Limite mensal de horas de voo excedido', description: `${totalFlightHours.toFixed(1)}h voadas — máximo: ${LIMITS.MAX_FLIGHT_HOURS_MONTH}h`, reference: 'RBAC 117, Apêndice B, Tabela 5' });
  } else if (totalFlightHours > LIMITS.MAX_FLIGHT_HOURS_MONTH * 0.85) {
    alerts.push({ type: 'warning', title: 'Próximo do limite mensal', description: `${totalFlightHours.toFixed(1)}h voadas de ${LIMITS.MAX_FLIGHT_HOURS_MONTH}h (${Math.round((totalFlightHours / LIMITS.MAX_FLIGHT_HOURS_MONTH) * 100)}%)`, reference: 'RBAC 117, Apêndice B, Tabela 5' });
  }

  // 2. 7-day limit (44h)
  if (hours7d > LIMITS.MAX_FLIGHT_HOURS_7D) {
    alerts.push({ type: 'danger', title: 'Limite de 7 dias excedido', description: `${hours7d.toFixed(1)}h em 7 dias — máximo: ${LIMITS.MAX_FLIGHT_HOURS_7D}h`, reference: 'RBAC 117, Apêndice B, Tabela 5' });
  } else if (hours7d > LIMITS.MAX_FLIGHT_HOURS_7D * 0.85) {
    alerts.push({ type: 'warning', title: 'Próximo do limite de 7 dias', description: `${hours7d.toFixed(1)}h em 7 dias de ${LIMITS.MAX_FLIGHT_HOURS_7D}h`, reference: 'RBAC 117, Apêndice B, Tabela 5' });
  }

  // 3. 28-day limit (100h)
  if (hours28d > LIMITS.MAX_FLIGHT_HOURS_28D) {
    alerts.push({ type: 'danger', title: 'Limite de 28 dias excedido', description: `${hours28d.toFixed(1)}h em 28 dias — máximo: ${LIMITS.MAX_FLIGHT_HOURS_28D}h`, reference: 'RBAC 117, Apêndice B, Tabela 5' });
  }

  // 4. Days off (8/month)
  if (daysOff < LIMITS.MIN_DAYS_OFF_MONTH) {
    alerts.push({ type: 'danger', title: 'Folgas insuficientes', description: `${daysOff} folgas no mês — mínimo: ${LIMITS.MIN_DAYS_OFF_MONTH}`, reference: 'RBAC 117, Apêndice B — Folgas periódicas' });
  } else if (daysOff <= LIMITS.MIN_DAYS_OFF_MONTH + 1) {
    alerts.push({ type: 'warning', title: 'Poucas folgas restantes', description: `${daysOff} folgas no mês — mínimo: ${LIMITS.MIN_DAYS_OFF_MONTH}`, reference: 'RBAC 117, Apêndice B — Folgas periódicas' });
  }

  // 5. Consecutive night ops
  if (maxConsecutiveNight > LIMITS.MAX_CONSECUTIVE_NIGHT_OPS) {
    alerts.push({ type: 'danger', title: 'Madrugadas consecutivas excedidas', description: `${maxConsecutiveNight} consecutivas — máximo: ${LIMITS.MAX_CONSECUTIVE_NIGHT_OPS}`, reference: 'RBAC 117, Apêndice B, item (o)' });
  }

  // 6. Rest between flights (BRT local times)
  const flightsSorted = sorted.filter(e => e.is_flight);
  for (let i = 1; i < flightsSorted.length; i++) {
    const prev = flightsSorted[i - 1];
    const curr = flightsSorted[i];

    // Previous arrival in BRT (with +1 day if crosses midnight)
    const prevArrival = getArrivalDateTimeBRT(prev);
    // Add 30min post-flight (debrief)
    const prevEnd = new TZDate(
      prevArrival.getFullYear(), prevArrival.getMonth(), prevArrival.getDate(),
      prevArrival.getHours(), prevArrival.getMinutes() + 30, 0, BRAZIL_TZ
    );

    // Current departure (report or departure) in BRT
    const currStart = toDateTimeBRT(curr.date, curr.report_time || curr.departure_time);

    const restMs = currStart.getTime() - prevEnd.getTime();
    const restHours = restMs / 3600000;

    if (restHours > 0 && restHours < LIMITS.MIN_REST_ACCLIMATED) {
      alerts.push({
        type: 'danger',
        title: `Repouso insuficiente (${prev.date} → ${curr.date})`,
        description: `${Math.floor(restHours)}h${Math.round((restHours % 1) * 60).toString().padStart(2, '0')}m — mínimo: ${LIMITS.MIN_REST_ACCLIMATED}h`,
        reference: 'RBAC 117, Apêndice B, Tabela 6',
      });
    }
  }

  const hasDanger = alerts.some(a => a.type === 'danger');
  const hasWarning = alerts.some(a => a.type === 'warning');
  const status: ComplianceResult['status'] = hasDanger ? 'irregular' : hasWarning ? 'atencao' : 'regular';
  const label = hasDanger ? 'Irregular' : hasWarning ? 'Atenção' : 'Regular';

  return {
    status, label, alerts,
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
