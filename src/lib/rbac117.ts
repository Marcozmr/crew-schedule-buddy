// RBAC 117 Apêndice B - Compliance Engine
// All calculations use America/Sao_Paulo timezone (BRT/BRST)
// Flights AND standbys grouped into duty periods before rest calculation

import { TZDate } from '@date-fns/tz';
import { countsAsOperationalFlightBlockHours } from '@/lib/operational-flight-hours';
import type { ScheduleEntry as AppScheduleEntry } from '@/hooks/useScheduleData';

const BRAZIL_TZ = 'America/Sao_Paulo';
const DUTY_GAP_THRESHOLD_MS = 10 * 3600000; // 10h in ms
const MAX_REASONABLE_REST_MS = 72 * 3600000; // 72h — flag as possible error

// Activity types that are NOT flights
const DAY_OFF_CODES = new Set(['DO', 'FOLGA', 'OFF', 'X']);
const STANDBY_CODES = new Set(['HSB', 'ASB', 'HSBE', 'SBY', 'RSV', 'RES', 'APR']);
const GROUND_DUTY_CODES = new Set(['TRE', 'SIM', 'GND', 'ADM']);

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
  standbyCount: number;
  totalFlightsCount: number;
  totalDutyHoursMonth: number;
  dutyPeriods: DutyPeriod[];
}

export interface ComplianceAlert {
  type: 'danger' | 'warning' | 'info';
  title: string;
  description: string;
  reference: string;
}

export interface DutyPeriod {
  date: string;          // YYYY-MM-DD
  startTime: string;     // HH:mm BRT
  endTime: string;       // HH:mm BRT
  startMs: number;
  endMs: number;
  totalFlightHours: number;
  totalDutyHours: number;
  flightCount: number;
  crossesMidnight: boolean;
  flights: string[];
  restUntilNext: string | null; // e.g. "15h23m"
  restWarning?: boolean;        // true if rest < 12h or > 72h
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
  entry_type?: string | null;
  crew_status_code?: string | null;
  crew_status_label?: string | null;
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
  MIN_WEEKLY_REST: 36,
  MAX_DUTY_HOURS: 14,
  MAX_CONSECUTIVE_NIGHT_OPS: 2,
  MIN_DAYS_OFF_MONTH: 8,
};

// ─── Timezone helpers ───

function parseDateBRT(dateStr: string): TZDate {
  let year: number, month: number, day: number;
  if (dateStr.includes('-') && dateStr.indexOf('-') === 4) {
    [year, month, day] = dateStr.split('-').map(Number);
  } else {
    const parts = dateStr.split(/[-/]/);
    day = parseInt(parts[0]); month = parseInt(parts[1]); year = parseInt(parts[2]);
  }
  return new TZDate(year, month - 1, day, 0, 0, 0, BRAZIL_TZ);
}

function toDateTimeBRT(dateStr: string, time: string): TZDate {
  const base = parseDateBRT(dateStr);
  const [h, m] = time.split(':').map(Number);
  return new TZDate(base.getFullYear(), base.getMonth(), base.getDate(), h || 0, m || 0, 0, BRAZIL_TZ);
}

function getArrivalMs(entry: ScheduleEntry): number {
  const dep = toDateTimeBRT(entry.date, entry.departure_time);
  const arr = toDateTimeBRT(entry.date, entry.arrival_time);
  if (arr.getTime() <= dep.getTime()) {
    // Midnight crossing: arrival is next day
    return new TZDate(arr.getFullYear(), arr.getMonth(), arr.getDate() + 1, arr.getHours(), arr.getMinutes(), 0, BRAZIL_TZ).getTime();
  }
  return arr.getTime();
}

function getDepartureMs(entry: ScheduleEntry): number {
  return toDateTimeBRT(entry.date, entry.report_time || entry.departure_time).getTime();
}

function getEndMs(entry: ScheduleEntry): number {
  // For non-flight duties (standby, ground), use arrival_time or departure_time + duty_hours
  const arrMs = getArrivalMs(entry);
  const depMs = getDepartureMs(entry);
  // Ensure end > start
  return Math.max(arrMs, depMs + 3600000); // at minimum 1h duty
}

function getHourBRT(time: string): number {
  return parseInt(time.split(':')[0]) || 0;
}

function isNightOp(entry: ScheduleEntry): boolean {
  if (!isActualFlight(entry)) return false;
  const depH = getHourBRT(entry.departure_time);
  const arrDate = new TZDate(getArrivalMs(entry), BRAZIL_TZ);
  const arrH = arrDate.getHours();
  return depH < 6 || arrH < 6 || (entry.crosses_midnight && arrH < 6);
}

/** Voo operacional real (RBAC FH): não folga/reserva; exige regra OP/tripulando (ver operational-flight-hours). */
function isActualFlight(entry: ScheduleEntry): boolean {
  if (!entry.is_flight) return false;
  const code = (entry.activity_type || '').toUpperCase().trim();
  const fn = (entry.flight_number || '').toUpperCase().trim();
  if (DAY_OFF_CODES.has(code) || DAY_OFF_CODES.has(fn)) return false;
  if (STANDBY_CODES.has(code) || STANDBY_CODES.has(fn)) return false;
  if (GROUND_DUTY_CODES.has(code) || GROUND_DUTY_CODES.has(fn)) return false;
  return countsAsOperationalFlightBlockHours(entry as AppScheduleEntry);
}

/** Entry is a duty (flight, standby, or ground) but NOT a day off */
function isDutyEntry(entry: ScheduleEntry): boolean {
  const code = (entry.activity_type || '').toUpperCase().trim();
  const fn = (entry.flight_number || '').toUpperCase().trim();
  if (DAY_OFF_CODES.has(code) || DAY_OFF_CODES.has(fn)) return false;
  return true;
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

function formatTime(ms: number): string {
  const d = new TZDate(ms, BRAZIL_TZ);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatRestDuration(ms: number): string {
  if (ms <= 0) return '0h00m';
  const h = Math.floor(ms / 3600000);
  const m = Math.round((ms % 3600000) / 60000);
  return `${h}h${m.toString().padStart(2, '0')}m`;
}

// ─── Duty Period grouping ───
// CRITICAL: Include ALL duty entries (flights + standbys + ground), not just flights
// Rest is calculated between consecutive duty periods only

function buildDutyPeriods(dutyEntries: ScheduleEntry[]): DutyPeriod[] {
  if (dutyEntries.length === 0) return [];

  // Sort strictly by departure/report datetime
  const sorted = [...dutyEntries].sort((a, b) => getDepartureMs(a) - getDepartureMs(b));

  const periods: { entries: ScheduleEntry[]; startMs: number; endMs: number }[] = [];

  let current = {
    entries: [sorted[0]],
    startMs: getDepartureMs(sorted[0]),
    endMs: getEndMs(sorted[0]),
  };

  for (let i = 1; i < sorted.length; i++) {
    const depMs = getDepartureMs(sorted[i]);
    const gap = depMs - current.endMs;

    // Same duty period: same date OR gap < threshold
    const sameDate = sorted[i].date === current.entries[current.entries.length - 1].date;
    if (sameDate || gap < DUTY_GAP_THRESHOLD_MS) {
      current.entries.push(sorted[i]);
      current.startMs = Math.min(current.startMs, depMs);
      current.endMs = Math.max(current.endMs, getEndMs(sorted[i]));
    } else {
      periods.push(current);
      current = { entries: [sorted[i]], startMs: depMs, endMs: getEndMs(sorted[i]) };
    }
  }
  periods.push(current);

  // Validate: ensure periods are sorted and non-overlapping
  periods.sort((a, b) => a.startMs - b.startMs);
  for (let i = 1; i < periods.length; i++) {
    if (periods[i].startMs < periods[i - 1].endMs) {
      // Overlap: merge into previous
      periods[i - 1].entries.push(...periods[i].entries);
      periods[i - 1].endMs = Math.max(periods[i - 1].endMs, periods[i].endMs);
      periods.splice(i, 1);
      i--;
    }
  }

  // Build result with rest between CONSECUTIVE periods only
  const result: DutyPeriod[] = periods.map((p, idx) => {
    const flightEntries = p.entries.filter(e => isActualFlight(e));
    const fh = flightEntries.reduce((s, e) => s + (e.flight_hours || 0), 0);
    const dutyMs = p.endMs - p.startMs;
    const dutyH = Math.round((dutyMs / 3600000) * 10) / 10;
    const cm = p.entries.some(e => e.crosses_midnight);
    const startDate = new TZDate(p.startMs, BRAZIL_TZ);
    const dateStr = `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}-${startDate.getDate().toString().padStart(2, '0')}`;

    let restUntilNext: string | null = null;
    let restWarning = false;

    if (idx < periods.length - 1) {
      const nextStart = periods[idx + 1].startMs;
      const thisEnd = p.endMs + 30 * 60000; // +30min debrief
      const restMs = nextStart - thisEnd;

      // Safeguards
      if (restMs < 0) {
        restUntilNext = '⚠️ sobreposição';
        restWarning = true;
      } else if (restMs > MAX_REASONABLE_REST_MS) {
        // Flag but still show
        restUntilNext = formatRestDuration(restMs) + ' ⚠️';
        restWarning = true;
      } else {
        restUntilNext = formatRestDuration(restMs);
        if (restMs < LIMITS.MIN_REST_ACCLIMATED * 3600000) {
          restWarning = true;
        }
      }
    }

    return {
      date: dateStr,
      startTime: formatTime(p.startMs),
      endTime: formatTime(p.endMs),
      startMs: p.startMs,
      endMs: p.endMs,
      totalFlightHours: Math.round(fh * 10) / 10,
      totalDutyHours: dutyH,
      flightCount: flightEntries.length,
      crossesMidnight: cm,
      flights: flightEntries.map(e => e.flight_number).filter(Boolean),
      restUntilNext,
      restWarning,
    };
  });

  return result;
}

// ─── Main compliance check ───

export function checkCompliance(
  schedule: ScheduleEntry[],
  currentDate: Date = new Date()
): ComplianceResult {
  const alerts: ComplianceAlert[] = [];
  const now = new TZDate(currentDate, BRAZIL_TZ);
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthEntries = schedule.filter(e => {
    const d = parseDateBRT(e.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const sorted = [...monthEntries].sort((a, b) => parseDateBRT(a.date).getTime() - parseDateBRT(b.date).getTime());

  // Filter actual flights only for FH accumulation
  const monthFlights = sorted.filter(e => isActualFlight(e));
  const totalFlightHours = monthFlights.reduce((sum, e) => sum + (e.flight_hours || 0), 0);

  // Days off
  const daysOffFromSchedule = new Set(
    sorted.filter(e => {
      const code = (e.activity_type || '').toUpperCase().trim();
      const fn = (e.flight_number || '').toUpperCase().trim();
      return DAY_OFF_CODES.has(code) || DAY_OFF_CODES.has(fn);
    }).map(e => e.date)
  ).size;
  const allDates = new Set(sorted.map(e => e.date));
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysOff = daysOffFromSchedule + Math.max(0, daysInMonth - allDates.size);

  // Standbys
  const standbyCount = sorted.filter(e => {
    const code = (e.activity_type || '').toUpperCase().trim();
    const fn = (e.flight_number || '').toUpperCase().trim();
    return STANDBY_CODES.has(code) || STANDBY_CODES.has(fn);
  }).length;

  // Night ops (only actual flights)
  let nightOpsCount = 0;
  let consecutiveNightOps = 0;
  let maxConsecutiveNight = 0;
  monthFlights.forEach(entry => {
    if (isNightOp(entry)) { nightOpsCount++; consecutiveNightOps++; maxConsecutiveNight = Math.max(maxConsecutiveNight, consecutiveNightOps); }
    else { consecutiveNightOps = 0; }
  });

  // 7-day / 28-day windows
  const sevenDaysAgo = new TZDate(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, BRAZIL_TZ);
  const twentyEightDaysAgo = new TZDate(now.getFullYear(), now.getMonth(), now.getDate() - 28, 0, 0, 0, BRAZIL_TZ);
  const allFlights = schedule.filter(e => isActualFlight(e));
  const hours7d = allFlights.filter(e => { const t = parseDateBRT(e.date).getTime(); return t >= sevenDaysAgo.getTime() && t <= now.getTime(); }).reduce((s, e) => s + (e.flight_hours || 0), 0);
  const hours28d = allFlights.filter(e => { const t = parseDateBRT(e.date).getTime(); return t >= twentyEightDaysAgo.getTime() && t <= now.getTime(); }).reduce((s, e) => s + (e.flight_hours || 0), 0);

  // Build duty periods from ALL duty entries (flights + standbys + ground), NOT just flights
  const allDutyEntries = schedule.filter(e => isDutyEntry(e));
  const dutyPeriods = buildDutyPeriods(allDutyEntries);

  // Filter duty periods for current month (for display)
  const monthDutyPeriods = dutyPeriods.filter(dp => {
    const d = parseDateBRT(dp.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalDutyHoursMonth = monthDutyPeriods.reduce((s, dp) => s + dp.totalDutyHours, 0);

  // Duty limits
  const flightDates = new Set(monthFlights.map(e => e.date));
  const startHour = monthFlights.length > 0 ? getHourBRT(monthFlights[0].report_time || monthFlights[0].departure_time) : 8;
  const legsPerDay = Math.ceil(monthFlights.length / Math.max(flightDates.size, 1));
  const dutyLimits = DUTY_TABLE[getTimeRangeKey(startHour)]?.[getLegsKey(legsPerDay)] || [12, 9];

  // ===== COMPLIANCE CHECKS =====

  // Flight hours limits
  if (totalFlightHours > LIMITS.MAX_FLIGHT_HOURS_MONTH) {
    alerts.push({ type: 'danger', title: 'Limite mensal de horas de voo excedido', description: `${totalFlightHours.toFixed(1)}h voadas — máximo: ${LIMITS.MAX_FLIGHT_HOURS_MONTH}h`, reference: 'RBAC 117, Apêndice B, Tabela 5' });
  } else if (totalFlightHours > LIMITS.MAX_FLIGHT_HOURS_MONTH * 0.85) {
    alerts.push({ type: 'warning', title: 'Próximo do limite mensal', description: `${totalFlightHours.toFixed(1)}h voadas de ${LIMITS.MAX_FLIGHT_HOURS_MONTH}h (${Math.round((totalFlightHours / LIMITS.MAX_FLIGHT_HOURS_MONTH) * 100)}%)`, reference: 'RBAC 117, Apêndice B, Tabela 5' });
  }

  if (hours7d > LIMITS.MAX_FLIGHT_HOURS_7D) {
    alerts.push({ type: 'danger', title: 'Limite de 7 dias excedido', description: `${hours7d.toFixed(1)}h em 7 dias — máximo: ${LIMITS.MAX_FLIGHT_HOURS_7D}h`, reference: 'RBAC 117, Apêndice B, Tabela 5' });
  } else if (hours7d > LIMITS.MAX_FLIGHT_HOURS_7D * 0.85) {
    alerts.push({ type: 'warning', title: 'Próximo do limite de 7 dias', description: `${hours7d.toFixed(1)}h em 7 dias de ${LIMITS.MAX_FLIGHT_HOURS_7D}h`, reference: 'RBAC 117, Apêndice B, Tabela 5' });
  }

  if (hours28d > LIMITS.MAX_FLIGHT_HOURS_28D) {
    alerts.push({ type: 'danger', title: 'Limite de 28 dias excedido', description: `${hours28d.toFixed(1)}h em 28 dias — máximo: ${LIMITS.MAX_FLIGHT_HOURS_28D}h`, reference: 'RBAC 117, Apêndice B, Tabela 5' });
  }

  // Days off
  if (daysOff < LIMITS.MIN_DAYS_OFF_MONTH) {
    alerts.push({ type: 'danger', title: 'Folgas insuficientes', description: `${daysOff} folgas no mês — mínimo: ${LIMITS.MIN_DAYS_OFF_MONTH}`, reference: 'RBAC 117, Apêndice B — Folgas periódicas' });
  } else if (daysOff <= LIMITS.MIN_DAYS_OFF_MONTH + 1) {
    alerts.push({ type: 'warning', title: 'Poucas folgas restantes', description: `${daysOff} folgas no mês — mínimo: ${LIMITS.MIN_DAYS_OFF_MONTH}`, reference: 'RBAC 117, Apêndice B — Folgas periódicas' });
  }

  // Night ops
  if (maxConsecutiveNight > LIMITS.MAX_CONSECUTIVE_NIGHT_OPS) {
    alerts.push({ type: 'danger', title: 'Madrugadas consecutivas excedidas', description: `${maxConsecutiveNight} consecutivas — máximo: ${LIMITS.MAX_CONSECUTIVE_NIGHT_OPS}`, reference: 'RBAC 117, Apêndice B, item (o)' });
  }

  // REST between CONSECUTIVE duty periods
  for (let i = 1; i < dutyPeriods.length; i++) {
    const prev = dutyPeriods[i - 1];
    const curr = dutyPeriods[i];
    const prevEndWithDebrief = prev.endMs + 30 * 60000;
    const restMs = curr.startMs - prevEndWithDebrief;
    const restHours = restMs / 3600000;

    // Negative rest = overlapping duties
    if (restMs < 0) {
      alerts.push({
        type: 'danger',
        title: `Sobreposição de jornadas (${prev.date} → ${curr.date})`,
        description: 'Jornadas sobrepostas detectadas — verificar escala',
        reference: 'RBAC 117 — Integridade da escala',
      });
    } else if (restHours < LIMITS.MIN_REST_ACCLIMATED && restHours >= 0) {
      const h = Math.floor(restHours);
      const m = Math.round((restHours - h) * 60);
      alerts.push({
        type: 'danger',
        title: `Repouso insuficiente (${prev.date} → ${curr.date})`,
        description: `${h}h${m.toString().padStart(2, '0')}m entre jornadas — mínimo: ${LIMITS.MIN_REST_ACCLIMATED}h`,
        reference: 'RBAC 117, Apêndice B, Tabela 6',
      });
    }
  }

  // MAX DUTY HOURS per period
  for (const dp of monthDutyPeriods) {
    if (dp.totalDutyHours > LIMITS.MAX_DUTY_HOURS) {
      alerts.push({
        type: 'danger',
        title: `Jornada excede ${LIMITS.MAX_DUTY_HOURS}h (${dp.date})`,
        description: `${dp.totalDutyHours}h de jornada — máximo: ${LIMITS.MAX_DUTY_HOURS}h`,
        reference: 'RBAC 117, Apêndice B, Tabela 4',
      });
    }
  }

  // WEEKLY REST: check 7-day sliding window for 36h consecutive rest
  // Simplified: check if any 7-day window lacks a 36h rest gap
  const recentDuties = dutyPeriods.filter(dp => {
    const t = parseDateBRT(dp.date).getTime();
    return t >= sevenDaysAgo.getTime() && t <= now.getTime();
  });
  if (recentDuties.length >= 2) {
    let hasWeeklyRest = false;
    for (let i = 1; i < recentDuties.length; i++) {
      const prevEnd = recentDuties[i - 1].endMs + 30 * 60000;
      const nextStart = recentDuties[i].startMs;
      if ((nextStart - prevEnd) >= LIMITS.MIN_WEEKLY_REST * 3600000) {
        hasWeeklyRest = true;
        break;
      }
    }
    if (!hasWeeklyRest && recentDuties.length > 0) {
      alerts.push({
        type: 'warning',
        title: 'Repouso semanal insuficiente',
        description: `Nenhum repouso ≥ ${LIMITS.MIN_WEEKLY_REST}h nos últimos 7 dias`,
        reference: 'RBAC 117, Apêndice B — Repouso semanal',
      });
    }
  }

  // CONSECUTIVE EARLY DUTIES (report before 06:00)
  let consecutiveEarly = 0;
  let maxConsecutiveEarly = 0;
  for (const dp of monthDutyPeriods) {
    const h = getHourBRT(dp.startTime);
    if (h < 6) { consecutiveEarly++; maxConsecutiveEarly = Math.max(maxConsecutiveEarly, consecutiveEarly); }
    else { consecutiveEarly = 0; }
  }
  if (maxConsecutiveEarly >= 3) {
    alerts.push({
      type: 'warning',
      title: `${maxConsecutiveEarly} jornadas consecutivas com início antes das 06:00`,
      description: 'Apresentações de madrugada consecutivas aumentam risco de fadiga',
      reference: 'RBAC 117 — Gestão de fadiga',
    });
  }

  const hasDanger = alerts.some(a => a.type === 'danger');
  const hasWarning = alerts.some(a => a.type === 'warning');

  return {
    status: hasDanger ? 'irregular' : hasWarning ? 'atencao' : 'regular',
    label: hasDanger ? 'Irregular' : hasWarning ? 'Atenção' : 'Regular',
    alerts,
    maxDutyHours: dutyLimits[0],
    maxFlightHours: dutyLimits[1],
    minRestHours: LIMITS.MIN_REST_ACCLIMATED,
    accumulatedHoursMonth: totalFlightHours,
    accumulatedHours7Days: hours7d,
    accumulatedHours28Days: hours28d,
    nightOpsCount,
    daysOffCount: daysOff,
    standbyCount,
    totalFlightsCount: monthFlights.length,
    totalDutyHoursMonth: Math.round(totalDutyHoursMonth * 10) / 10,
    dutyPeriods: monthDutyPeriods,
  };
}
