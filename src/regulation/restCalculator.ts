/**
 * EscalaX Regulation Engine — Rest Calculator
 * 
 * Calculates rest periods between consecutive duty periods.
 * Rest = previous duty end → next duty report time.
 * Applies augmentation rules when crew is out-of-base.
 */

import type { DutyCalculation, RestCalculation, ScheduleWindow } from './types';
import { calculateDuty } from './dutyCalculator';

const DEBRIEF_MS = 30 * 60 * 1000;

/**
 * Base minimum rest hours per RBAC 117 for acclimated crew.
 * May be augmented by specific airline rules.
 */
const BASE_MIN_REST_HOURS = 12;

/**
 * Additional rest hours when duty starts or ends outside base.
 */
const OUT_OF_BASE_AUGMENTATION_HOURS = 2;

/**
 * Calculate rest before and after a specific duty period within a schedule window.
 * 
 * @param dutyIndex - Index of the duty period to evaluate
 * @param allDuties - Pre-calculated duty results for all periods in window
 * @param window - The full schedule window for context
 */
export function calculateRest(
  dutyIndex: number,
  allDuties: DutyCalculation[],
  window: ScheduleWindow
): RestCalculation {
  const currentDuty = allDuties[dutyIndex];
  const currentEnd = new Date(currentDuty.endTimeUtc).getTime();
  const currentReport = new Date(currentDuty.reportTimeUtc).getTime();

  // Rest before this duty
  let restBeforeDutyMs: number | null = null;
  let restBeforeDutyHours: number | null = null;

  if (dutyIndex > 0) {
    const prevEnd = new Date(allDuties[dutyIndex - 1].endTimeUtc).getTime();
    restBeforeDutyMs = currentReport - prevEnd;
    restBeforeDutyHours = round2(restBeforeDutyMs / 3600000);
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
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
