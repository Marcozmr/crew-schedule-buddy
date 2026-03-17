/**
 * EscalaX Regulation Engine — Fatigue Calculator
 * 
 * Composite fatigue risk score (0-100) based on:
 * - Duty duration
 * - WOCL exposure (02:00-06:00 local) — now from time segmentation
 * - Number of sectors
 * - Early report penalty
 * - Consecutive patterns
 * - Madrugada count in 168h window (real count, not proxy)
 */

import type {
  DutyCalculation,
  FatigueCalculation,
  FatigueFactor,
  WoclExposure,
  ScheduleWindow,
} from './types';

// ─── WOCL from duty time breakdown ───

/**
 * Calculate WOCL exposure from pre-computed duty time breakdown.
 * The duty calculator already segments time — we just extract WOCL data.
 */
export function calculateWoclExposure(
  duty: DutyCalculation,
  _timezone: string
): WoclExposure {
  // WOCL minutes come from the duty time breakdown (already segmented)
  const totalMinutes = duty.dutyTimeBreakdown.woclMinutes;

  // Build windows from segments for audit trail
  const windows: WoclExposure['windows'] = [];
  if (totalMinutes > 0) {
    windows.push({
      startUtc: duty.reportTimeUtc,
      endUtc: duty.endTimeUtc,
      durationMinutes: totalMinutes,
    });
  }

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
 * Count consecutive madrugada duties (touching 00:00-06:00 local) ending at current duty.
 * Uses isMadrugadaDuty from duty calculator (based on real time segmentation).
 */
export function countConsecutiveMadrugadaDuties(
  allDuties: DutyCalculation[],
  currentIndex: number
): number {
  let count = 0;
  for (let i = currentIndex; i >= 0; i--) {
    if (allDuties[i].isMadrugadaDuty) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Count madrugada duties in the last 168h (7 days) from the current duty.
 * This is the REAL count, not a proxy based on consecutive nights.
 */
export function countMadrugadasIn168h(
  allDuties: DutyCalculation[],
  currentIndex: number
): number {
  const currentReportMs = new Date(allDuties[currentIndex].reportTimeUtc).getTime();
  const windowStartMs = currentReportMs - 168 * 3600000; // 168h = 7 days

  let count = 0;
  for (let i = currentIndex; i >= 0; i--) {
    const dutyReportMs = new Date(allDuties[i].reportTimeUtc).getTime();
    if (dutyReportMs < windowStartMs) break;
    if (allDuties[i].isMadrugadaDuty) count++;
  }
  return count;
}

// ─── Fatigue scoring weights ───

const WEIGHTS = {
  dutyHours: 0.25,
  woclExposure: 0.20,
  sectors: 0.10,
  earlyReport: 0.15,
  consecutiveNight: 0.15,
  madrugadas168h: 0.15,
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
  const consecutiveNightDuties = countConsecutiveMadrugadaDuties(allDuties, dutyIndex);
  const madrugadasIn168h = countMadrugadasIn168h(allDuties, dutyIndex);

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

  // 5. Consecutive madrugada duties
  const nightScore = Math.min(100, (consecutiveNightDuties / 3) * 100);
  factors.push({
    name: 'consecutive_madrugada',
    weight: WEIGHTS.consecutiveNight,
    rawValue: consecutiveNightDuties,
    contribution: round2(nightScore * WEIGHTS.consecutiveNight),
    description: `${consecutiveNightDuties} madrugada(s) consecutiva(s)`,
  });

  // 6. Madrugadas in 168h window
  const mad168Score = Math.min(100, (madrugadasIn168h / 4) * 100);
  factors.push({
    name: 'madrugadas_168h',
    weight: WEIGHTS.madrugadas168h,
    rawValue: madrugadasIn168h,
    contribution: round2(mad168Score * WEIGHTS.madrugadas168h),
    description: `${madrugadasIn168h} madrugada(s) em 168h (limite: 4)`,
  });

  const riskScore = Math.round(factors.reduce((s, f) => s + f.contribution, 0));

  return {
    riskScore: Math.min(100, riskScore),
    factors,
    woclExposure,
    consecutiveEarlyStarts,
    consecutiveNightDuties,
    madrugadasIn168h,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
