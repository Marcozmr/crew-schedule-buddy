/**
 * EscalaX Regulation Engine — Fatigue Calculator
 * 
 * Composite fatigue risk score (0-100) based on:
 * - Duty duration
 * - WOCL exposure (02:00-06:00 local)
 * - Number of sectors
 * - Early report penalty
 * - Consecutive patterns
 * 
 * Designed to align with FRMS (Fatigue Risk Management System) principles.
 */

import { TZDate } from '@date-fns/tz';
import type {
  DutyCalculation,
  FatigueCalculation,
  FatigueFactor,
  WoclExposure,
  ScheduleWindow,
} from './types';
import { calculateDuty } from './dutyCalculator';

// ─── WOCL: Window of Circadian Low (02:00-06:00 local) ───

const WOCL_START_HOUR = 2;
const WOCL_END_HOUR = 6;

/**
 * Calculate WOCL exposure for a duty period.
 * Checks overlap between duty [reportUtc, endUtc] and each 02:00-06:00 local window.
 */
export function calculateWoclExposure(
  duty: DutyCalculation,
  timezone: string
): WoclExposure {
  const reportMs = new Date(duty.reportTimeUtc).getTime();
  const endMs = new Date(duty.endTimeUtc).getTime();

  // Generate WOCL windows for each day the duty spans
  const reportLocal = new TZDate(reportMs, timezone);
  const endLocal = new TZDate(endMs, timezone);

  const windows: WoclExposure['windows'] = [];

  // Check up to 3 days (duty should never span more)
  for (let dayOffset = -1; dayOffset <= 2; dayOffset++) {
    const woclStart = new TZDate(
      reportLocal.getFullYear(), reportLocal.getMonth(), reportLocal.getDate() + dayOffset,
      WOCL_START_HOUR, 0, 0, timezone
    ).getTime();
    const woclEnd = new TZDate(
      reportLocal.getFullYear(), reportLocal.getMonth(), reportLocal.getDate() + dayOffset,
      WOCL_END_HOUR, 0, 0, timezone
    ).getTime();

    // Overlap: max(start1, start2) < min(end1, end2)
    const overlapStart = Math.max(reportMs, woclStart);
    const overlapEnd = Math.min(endMs, woclEnd);

    if (overlapStart < overlapEnd) {
      windows.push({
        startUtc: new Date(overlapStart).toISOString(),
        endUtc: new Date(overlapEnd).toISOString(),
        durationMinutes: Math.round((overlapEnd - overlapStart) / 60000),
      });
    }
  }

  const totalMinutes = windows.reduce((s, w) => s + w.durationMinutes, 0);

  return { totalMinutes, windows };
}

/**
 * Count consecutive early starts (report before 06:00 local) ending at current duty.
 */
export function countConsecutiveEarlyStarts(
  allDuties: DutyCalculation[],
  currentIndex: number
): number {
  let count = 0;
  for (let i = currentIndex; i >= 0; i--) {
    if (allDuties[i].reportHourLocal < 6) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Count consecutive night duties (any part of duty in WOCL) ending at current duty.
 */
export function countConsecutiveNightDuties(
  allDuties: DutyCalculation[],
  currentIndex: number,
  timezone: string
): number {
  let count = 0;
  for (let i = currentIndex; i >= 0; i--) {
    const wocl = calculateWoclExposure(allDuties[i], timezone);
    if (wocl.totalMinutes > 0) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// ─── Fatigue scoring weights ───

const WEIGHTS = {
  dutyHours: 0.30,
  woclExposure: 0.25,
  sectors: 0.15,
  earlyReport: 0.15,
  consecutiveNight: 0.15,
};

/**
 * Calculate composite fatigue risk score.
 */
export function calculateFatigue(
  duty: DutyCalculation,
  allDuties: DutyCalculation[],
  dutyIndex: number,
  timezone: string
): FatigueCalculation {
  const woclExposure = calculateWoclExposure(duty, timezone);
  const consecutiveEarlyStarts = countConsecutiveEarlyStarts(allDuties, dutyIndex);
  const consecutiveNightDuties = countConsecutiveNightDuties(allDuties, dutyIndex, timezone);

  const factors: FatigueFactor[] = [];

  // 1. Duty hours (normalize: 0-14h → 0-100)
  const dutyScore = Math.min(100, (duty.totalDutyHours / 14) * 100);
  factors.push({
    name: 'duty_hours',
    weight: WEIGHTS.dutyHours,
    rawValue: duty.totalDutyHours,
    contribution: round2(dutyScore * WEIGHTS.dutyHours),
    description: `${duty.totalDutyHours}h de jornada (ref: 14h máximo)`,
  });

  // 2. WOCL exposure (normalize: 0-240min → 0-100)
  const woclScore = Math.min(100, (woclExposure.totalMinutes / 240) * 100);
  factors.push({
    name: 'wocl_exposure',
    weight: WEIGHTS.woclExposure,
    rawValue: woclExposure.totalMinutes,
    contribution: round2(woclScore * WEIGHTS.woclExposure),
    description: `${woclExposure.totalMinutes}min em WOCL (02:00-06:00)`,
  });

  // 3. Sectors (normalize: 1-7 → 0-100)
  const sectorScore = Math.min(100, ((duty.sectorCount - 1) / 6) * 100);
  factors.push({
    name: 'sectors',
    weight: WEIGHTS.sectors,
    rawValue: duty.sectorCount,
    contribution: round2(Math.max(0, sectorScore) * WEIGHTS.sectors),
    description: `${duty.sectorCount} setores na jornada`,
  });

  // 4. Early report penalty (report before 06:00 = high penalty)
  const earlyScore = duty.reportHourLocal < 6
    ? Math.min(100, ((6 - duty.reportHourLocal) / 6) * 100)
    : 0;
  factors.push({
    name: 'early_report',
    weight: WEIGHTS.earlyReport,
    rawValue: duty.reportHourLocal,
    contribution: round2(earlyScore * WEIGHTS.earlyReport),
    description: `Apresentação às ${duty.reportTimeLocal.slice(11, 16)} local`,
  });

  // 5. Consecutive night duties
  const nightScore = Math.min(100, (consecutiveNightDuties / 3) * 100);
  factors.push({
    name: 'consecutive_night',
    weight: WEIGHTS.consecutiveNight,
    rawValue: consecutiveNightDuties,
    contribution: round2(nightScore * WEIGHTS.consecutiveNight),
    description: `${consecutiveNightDuties} noites consecutivas`,
  });

  const riskScore = Math.round(factors.reduce((s, f) => s + f.contribution, 0));

  return {
    riskScore: Math.min(100, riskScore),
    factors,
    woclExposure,
    consecutiveEarlyStarts,
    consecutiveNightDuties,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
