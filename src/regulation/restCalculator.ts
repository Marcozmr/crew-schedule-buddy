/**
 * EscalaX Regulation Engine — Rest Calculator
 * 
 * Calculates rest periods between consecutive duty periods.
 * Rest = previous duty end → next duty report time.
 * Now includes time breakdown of rest periods.
 */

import type { DutyCalculation, RestCalculation, ScheduleWindow, TimeBreakdown } from './types';
import { splitIntervalByTimeWindows } from '@/lib/time-segments';

const BASE_MIN_REST_HOURS = 12;
const OUT_OF_BASE_AUGMENTATION_HOURS = 2;

/**
 * Calculate rest before and after a specific duty period within a schedule window.
 * Includes time breakdown of rest period (day/night/madrugada).
 */
export function calculateRest(
  dutyIndex: number,
  allDuties: DutyCalculation[],
  window: ScheduleWindow
): RestCalculation {
  const currentDuty = allDuties[dutyIndex];
  const currentEnd = new Date(currentDuty.endTimeUtc).getTime();
  const currentReport = new Date(currentDuty.reportTimeUtc).getTime();
  const tz = window.crew.timezone || 'America/Sao_Paulo';

  // Rest before this duty
  let restBeforeDutyMs: number | null = null;
  let restBeforeDutyHours: number | null = null;
  let restBeforeBreakdown: TimeBreakdown | null = null;

  if (dutyIndex > 0) {
    const prevEnd = new Date(allDuties[dutyIndex - 1].endTimeUtc).getTime();
    restBeforeDutyMs = currentReport - prevEnd;
    restBeforeDutyHours = round2(restBeforeDutyMs / 3600000);

    // Time breakdown of rest period
    const bd = splitIntervalByTimeWindows(
      allDuties[dutyIndex - 1].endTimeUtc,
      currentDuty.reportTimeUtc,
      tz
    );
    restBeforeBreakdown = {
      totalMinutes: bd.totalMinutes,
      diurnoMinutes: bd.diurnoMinutes,
      noturnoMinutes: bd.noturnoMinutes,
      madrugadaMinutes: bd.madrugadaMinutes,
      woclMinutes: bd.woclMinutes,
    };
  }

  // Rest after this duty
  let restAfterDutyMs: number | null = null;
  let restAfterDutyHours: number | null = null;

  if (dutyIndex < allDuties.length - 1) {
    const nextReport = new Date(allDuties[dutyIndex + 1].reportTimeUtc).getTime();
    restAfterDutyMs = nextReport - currentEnd;
    restAfterDutyHours = round2(restAfterDutyMs / 3600000);
  }

  // Determine minimum required rest
  const augmented = currentDuty.startsOutsideBase || currentDuty.endsOutsideBase;
  const minRequiredRestHours = augmented
    ? BASE_MIN_REST_HOURS + OUT_OF_BASE_AUGMENTATION_HOURS
    : BASE_MIN_REST_HOURS;

  return {
    restBeforeDutyMs,
    restBeforeDutyHours,
    restAfterDutyMs,
    restAfterDutyHours,
    minRequiredRestHours,
    augmentedRest: augmented,
    restBeforeBreakdown,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
