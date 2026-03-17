/**
 * EscalaX Regulation Engine — Duty Calculator
 * 
 * Calculates duty period metrics from report time to 30min after last block-on.
 * All timestamps processed in UTC, local conversions via crew timezone.
 */

import { TZDate } from '@date-fns/tz';
import type { DutyPeriodInput, DutyCalculation } from './types';

const DEBRIEF_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get effective departure UTC (actual or scheduled)
 */
function getBlockOff(leg: DutyPeriodInput['legs'][0]): number {
  return new Date(leg.actualDepartureUtc || leg.scheduledDepartureUtc).getTime();
}

/**
 * Get effective arrival UTC (actual or scheduled)
 */
function getBlockOn(leg: DutyPeriodInput['legs'][0]): number {
  return new Date(leg.actualArrivalUtc || leg.scheduledArrivalUtc).getTime();
}

/**
 * Calculate all duty period metrics for a single duty period.
 * 
 * Duty = reportTime → lastBlockOn + 30min debrief
 * Flight time = sum of (blockOn - blockOff) per leg
 */
export function calculateDuty(
  input: DutyPeriodInput,
  timezone: string = 'America/Sao_Paulo'
): DutyCalculation {
  const reportMs = new Date(input.reportTimeUtc).getTime();

  // Sort legs by departure time
  const sortedLegs = [...input.legs]
    .filter(l => l.activityType === 'flight' || l.activityType === 'positioning')
    .sort((a, b) => getBlockOff(a) - getBlockOff(b));

  // Flight time per leg
  const flightSegments = sortedLegs.map(leg => ({
    blockOff: getBlockOff(leg),
    blockOn: getBlockOn(leg),
    flightMs: getBlockOn(leg) - getBlockOff(leg),
  }));

  const totalFlightMs = flightSegments.reduce((sum, s) => sum + s.flightMs, 0);
  const sectorCount = sortedLegs.filter(l => l.activityType === 'flight').length;

  // Ground times between consecutive legs
  const groundTimesBetweenLegs: number[] = [];
  for (let i = 1; i < flightSegments.length; i++) {
    const gap = flightSegments[i].blockOff - flightSegments[i - 1].blockOn;
    groundTimesBetweenLegs.push(Math.max(0, gap));
  }
  const totalGroundTimeMs = groundTimesBetweenLegs.reduce((s, g) => s + g, 0);

  // End of duty: last block-on + 30min debrief
  const lastBlockOn = flightSegments.length > 0
    ? Math.max(...flightSegments.map(s => s.blockOn))
    : reportMs + 3600000; // fallback: 1h duty for non-flight duties

  const endMs = lastBlockOn + DEBRIEF_MS;
  const totalDutyMs = endMs - reportMs;

  // Local time conversions
  const reportLocal = new TZDate(reportMs, timezone);
  const endLocal = new TZDate(endMs, timezone);

  // Check if starts/ends outside base
  const firstDep = sortedLegs.length > 0 ? sortedLegs[0].departureAirport : input.baseAirport;
  const lastArr = sortedLegs.length > 0 ? sortedLegs[sortedLegs.length - 1].arrivalAirport : input.baseAirport;

  return {
    totalDutyMs,
    totalDutyHours: round2(totalDutyMs / 3600000),
    totalFlightMs,
    totalFlightHours: round2(totalFlightMs / 3600000),
    sectorCount,
    groundTimesBetweenLegs,
    totalGroundTimeMs,
    reportHourLocal: reportLocal.getHours(),
    endHourLocal: endLocal.getHours(),
    startsOutsideBase: firstDep !== input.baseAirport,
    endsOutsideBase: lastArr !== input.baseAirport,
    reportTimeUtc: new Date(reportMs).toISOString(),
    endTimeUtc: new Date(endMs).toISOString(),
    reportTimeLocal: formatLocal(reportLocal),
    endTimeLocal: formatLocal(endLocal),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatLocal(d: TZDate): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
