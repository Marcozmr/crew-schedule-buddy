/**
 * EscalaX Regulation Engine — Duty Calculator
 * 
 * Calculates duty period metrics from report time to 30min after last block-on.
 * Now with full time segmentation: day/night/madrugada/WOCL breakdown.
 */

import { TZDate } from '@date-fns/tz';
import type { DutyPeriodInput, DutyCalculation, GroundGapDetail } from './types';
import { splitIntervalByTimeWindows, classifyGroundTimes } from '@/lib/time-segments';

const DEFAULT_POST_FLIGHT_MINUTES = 30;

function getBlockOff(leg: DutyPeriodInput['legs'][0]): number {
  return new Date(leg.actualDepartureUtc || leg.scheduledDepartureUtc).getTime();
}

function getBlockOn(leg: DutyPeriodInput['legs'][0]): number {
  return new Date(leg.actualArrivalUtc || leg.scheduledArrivalUtc).getTime();
}

/**
 * Calculate all duty period metrics for a single duty period.
 * 
 * Duty = reportTime → lastBlockOn + 30min debrief
 * Flight time = sum of (blockOn - blockOff) per leg
 * 
 * Now includes: time segmentation, ground gap classification, madrugada detection.
 */
export function calculateDuty(
  input: DutyPeriodInput,
  timezone: string = 'America/Sao_Paulo'
): DutyCalculation {
  const reportMs = new Date(input.reportTimeUtc).getTime();

  // Trechos de bloco (voo + reposicionamento) para fim de jornada e conexões; horas de voo só em subset.
  const sortedLegs = [...input.legs]
    .filter(l => l.activityType === 'flight' || l.activityType === 'positioning')
    .sort((a, b) => getBlockOff(a) - getBlockOff(b));

  const flightHourLegs = sortedLegs.filter(
    l =>
      l.activityType === 'flight' &&
      (l.countsTowardFlightHourLimit === undefined || l.countsTowardFlightHourLimit !== false),
  );

  // Tempo de voo: apenas trechos operacionais (OP / tripulando), não PS nem duty não voo.
  const flightSegments = flightHourLegs.map(leg => ({
    blockOff: getBlockOff(leg),
    blockOn: getBlockOn(leg),
    flightMs: getBlockOn(leg) - getBlockOff(leg),
  }));

  const totalFlightMs = flightSegments.reduce((sum, s) => sum + s.flightMs, 0);
  const sectorCount = flightHourLegs.length;

  // Conexões no solo: usar todos os trechos de bloco (incl. PS) para gaps coerentes com a jornada.
  const blockSegmentsForDuty = sortedLegs.map(leg => ({
    blockOff: getBlockOff(leg),
    blockOn: getBlockOn(leg),
  }));

  const groundTimesBetweenLegs: number[] = [];
  const gapStartUtcs: string[] = [];
  const gapEndUtcs: string[] = [];

  for (let i = 1; i < blockSegmentsForDuty.length; i++) {
    const gapMs = Math.max(0, blockSegmentsForDuty[i].blockOff - blockSegmentsForDuty[i - 1].blockOn);
    groundTimesBetweenLegs.push(gapMs);
    gapStartUtcs.push(new Date(blockSegmentsForDuty[i - 1].blockOn).toISOString());
    gapEndUtcs.push(new Date(blockSegmentsForDuty[i].blockOff).toISOString());
  }

  const totalGroundTimeMs = groundTimesBetweenLegs.reduce((s, g) => s + g, 0);

  // Classify each ground gap as day/night
  const groundGapDetails: GroundGapDetail[] = classifyGroundTimes(gapStartUtcs, gapEndUtcs, timezone);

  // Fim de jornada: último block-on de qualquer trecho (incl. PS); horas de voo só em flightHourLegs.
  const lastBlockOn = blockSegmentsForDuty.length > 0
    ? Math.max(...blockSegmentsForDuty.map(s => s.blockOn))
    : reportMs + 3600000; // fallback: 1h duty for non-flight duties

  const postFlightMinutes = input.postFlightMinutes ?? DEFAULT_POST_FLIGHT_MINUTES;
  const endMs = lastBlockOn + postFlightMinutes * 60 * 1000;
  const totalDutyMs = endMs - reportMs;

  // Local time conversions
  const reportLocal = new TZDate(reportMs, timezone);
  const endLocal = new TZDate(endMs, timezone);

  // Check if starts/ends outside base
  const firstDep = sortedLegs.length > 0 ? sortedLegs[0].departureAirport : input.baseAirport;
  const lastArr = sortedLegs.length > 0 ? sortedLegs[sortedLegs.length - 1].arrivalAirport : input.baseAirport;

  // Full duty time breakdown
  const reportUtcStr = new Date(reportMs).toISOString();
  const endUtcStr = new Date(endMs).toISOString();
  const dutyBreakdown = splitIntervalByTimeWindows(reportUtcStr, endUtcStr, timezone);

  return {
    totalDutyMs,
    totalDutyHours: round2(totalDutyMs / 3600000),
    totalFlightMs,
    totalFlightHours: round2(totalFlightMs / 3600000),
    sectorCount,
    groundTimesBetweenLegs,
    groundGapDetails,
    totalGroundTimeMs,
    reportHourLocal: reportLocal.getHours(),
    endHourLocal: endLocal.getHours(),
    startsOutsideBase: firstDep !== input.baseAirport,
    endsOutsideBase: lastArr !== input.baseAirport,
    reportTimeUtc: reportUtcStr,
    endTimeUtc: endUtcStr,
    reportTimeLocal: formatLocal(reportLocal),
    endTimeLocal: formatLocal(endLocal),
    dutyTimeBreakdown: {
      totalMinutes: dutyBreakdown.totalMinutes,
      diurnoMinutes: dutyBreakdown.diurnoMinutes,
      noturnoMinutes: dutyBreakdown.noturnoMinutes,
      madrugadaMinutes: dutyBreakdown.madrugadaMinutes,
      woclMinutes: dutyBreakdown.woclMinutes,
    },
    isMadrugadaDuty: dutyBreakdown.madrugadaMinutes > 0,
    postFlightMinutes,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatLocal(d: TZDate): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
