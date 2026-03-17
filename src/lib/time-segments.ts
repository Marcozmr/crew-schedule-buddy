/**
 * EscalaX — Time Segmentation Utilities
 * 
 * Splits time intervals into classified segments: diurno, noturno, madrugada, WOCL.
 * All calculations use America/Sao_Paulo (BRT) local time.
 * 
 * Definitions (Brazilian aviation):
 * - Diurno: 06:00–18:00 local
 * - Noturno: 18:00–06:00 local (includes madrugada)
 * - Madrugada: 00:00–05:59 local (Lei 13.475 / ACT LATAM)
 * - WOCL (RBAC 117): 02:00–06:00 local
 */

import { TZDate } from '@date-fns/tz';

// ─── Types ───

export interface TimeSegment {
  startUtc: string;
  endUtc: string;
  durationMinutes: number;
  classification: 'diurno' | 'noturno' | 'madrugada' | 'wocl';
}

export interface IntervalBreakdown {
  totalMinutes: number;
  diurnoMinutes: number;
  noturnoMinutes: number;
  /** 00:00–05:59 local */
  madrugadaMinutes: number;
  /** 02:00–06:00 local */
  woclMinutes: number;
  segments: TimeSegment[];
}

export interface GroundTimeClassification {
  gapIndex: number;
  startUtc: string;
  endUtc: string;
  totalMinutes: number;
  isDayGap: boolean;
  isNightGap: boolean;
  diurnoMinutes: number;
  noturnoMinutes: number;
}

// ─── Time window boundaries (hour, minute) ───

interface TimeWindow {
  label: 'madrugada' | 'wocl' | 'diurno' | 'noturno';
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
}

// Windows within a single day (00:00–24:00), ordered
const DAY_WINDOWS: TimeWindow[] = [
  { label: 'madrugada', startHour: 0, startMin: 0, endHour: 2, endMin: 0 },
  { label: 'wocl', startHour: 2, startMin: 0, endHour: 6, endMin: 0 },
  { label: 'diurno', startHour: 6, startMin: 0, endHour: 18, endMin: 0 },
  { label: 'noturno', startHour: 18, startMin: 0, endHour: 24, endMin: 0 },
];

// Note: madrugada is 00:00-05:59 = 00:00-06:00 for calculation purposes
// WOCL is 02:00-06:00
// So 00:00-02:00 = madrugada only (not WOCL)
// 02:00-06:00 = both madrugada AND WOCL
// For classification: madrugada ⊃ WOCL partially

// ─── Core: split an interval into day-boundary chunks ───

/**
 * Splits an interval [startUtc, endUtc] into per-day segments at local midnight boundaries.
 * Returns array of { startMs, endMs } in UTC.
 */
function splitByLocalMidnight(
  startMs: number,
  endMs: number,
  timezone: string
): Array<{ startMs: number; endMs: number; localDate: Date }> {
  if (endMs <= startMs) return [];

  const chunks: Array<{ startMs: number; endMs: number; localDate: Date }> = [];
  let cursor = startMs;

  while (cursor < endMs) {
    const local = new TZDate(cursor, timezone);
    // Next midnight in local tz
    const nextMidnight = new TZDate(
      local.getFullYear(), local.getMonth(), local.getDate() + 1,
      0, 0, 0, timezone
    ).getTime();

    const chunkEnd = Math.min(endMs, nextMidnight);
    chunks.push({ startMs: cursor, endMs: chunkEnd, localDate: local });
    cursor = chunkEnd;
  }

  return chunks;
}

/**
 * For a chunk within a single local day, classify minutes into time windows.
 */
function classifyDayChunk(
  startMs: number,
  endMs: number,
  timezone: string
): TimeSegment[] {
  if (endMs <= startMs) return [];

  const local = new TZDate(startMs, timezone);
  const dayStart = new TZDate(
    local.getFullYear(), local.getMonth(), local.getDate(),
    0, 0, 0, timezone
  ).getTime();

  const segments: TimeSegment[] = [];

  // Boundaries within the day (in ms from dayStart)
  const boundaries = [
    { hour: 0, label: 'madrugada' as const },
    { hour: 2, label: 'wocl' as const },
    { hour: 6, label: 'diurno' as const },
    { hour: 18, label: 'noturno' as const },
    { hour: 24, label: 'end' as const },
  ];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const winStart = dayStart + boundaries[i].hour * 3600000;
    const winEnd = dayStart + boundaries[i + 1].hour * 3600000;
    const label = boundaries[i].label;

    const overlapStart = Math.max(startMs, winStart);
    const overlapEnd = Math.min(endMs, winEnd);

    if (overlapStart < overlapEnd) {
      segments.push({
        startUtc: new Date(overlapStart).toISOString(),
        endUtc: new Date(overlapEnd).toISOString(),
        durationMinutes: Math.round((overlapEnd - overlapStart) / 60000),
        classification: label === 'end' ? 'noturno' : label,
      });
    }
  }

  return segments;
}

// ─── Public API ───

/**
 * Splits any UTC interval into classified time segments by local time windows.
 */
export function splitIntervalByTimeWindows(
  startUtc: string,
  endUtc: string,
  timezone: string = 'America/Sao_Paulo'
): IntervalBreakdown {
  const startMs = new Date(startUtc).getTime();
  const endMs = new Date(endUtc).getTime();

  if (endMs <= startMs) {
    return { totalMinutes: 0, diurnoMinutes: 0, noturnoMinutes: 0, madrugadaMinutes: 0, woclMinutes: 0, segments: [] };
  }

  const dayChunks = splitByLocalMidnight(startMs, endMs, timezone);
  const allSegments: TimeSegment[] = [];

  for (const chunk of dayChunks) {
    allSegments.push(...classifyDayChunk(chunk.startMs, chunk.endMs, timezone));
  }

  const totalMinutes = Math.round((endMs - startMs) / 60000);

  let diurnoMinutes = 0;
  let noturnoMinutes = 0;
  let madrugadaMinutes = 0;
  let woclMinutes = 0;

  for (const seg of allSegments) {
    switch (seg.classification) {
      case 'diurno':
        diurnoMinutes += seg.durationMinutes;
        break;
      case 'noturno':
        noturnoMinutes += seg.durationMinutes;
        break;
      case 'madrugada':
        madrugadaMinutes += seg.durationMinutes;
        noturnoMinutes += seg.durationMinutes; // madrugada is subset of noturno
        break;
      case 'wocl':
        woclMinutes += seg.durationMinutes;
        madrugadaMinutes += seg.durationMinutes; // WOCL 02-06 is inside madrugada 00-06
        noturnoMinutes += seg.durationMinutes;
        break;
    }
  }

  return { totalMinutes, diurnoMinutes, noturnoMinutes, madrugadaMinutes, woclMinutes, segments: allSegments };
}

/**
 * Calculate only night minutes (18:00–06:00 local) for an interval.
 */
export function calculateNightMinutes(
  startUtc: string,
  endUtc: string,
  timezone: string = 'America/Sao_Paulo'
): number {
  return splitIntervalByTimeWindows(startUtc, endUtc, timezone).noturnoMinutes;
}

/**
 * Calculate WOCL minutes (02:00–06:00 local) for an interval.
 */
export function calculateWOCLMinutes(
  startUtc: string,
  endUtc: string,
  timezone: string = 'America/Sao_Paulo'
): number {
  return splitIntervalByTimeWindows(startUtc, endUtc, timezone).woclMinutes;
}

/**
 * Calculate madrugada minutes (00:00–06:00 local) for an interval.
 */
export function calculateMadrugadaMinutes(
  startUtc: string,
  endUtc: string,
  timezone: string = 'America/Sao_Paulo'
): number {
  return splitIntervalByTimeWindows(startUtc, endUtc, timezone).madrugadaMinutes;
}

/**
 * Classify each ground time gap between legs as day/night with breakdown.
 */
export function classifyGroundTimes(
  gapStartUtcs: string[],
  gapEndUtcs: string[],
  timezone: string = 'America/Sao_Paulo'
): GroundTimeClassification[] {
  const results: GroundTimeClassification[] = [];

  for (let i = 0; i < gapStartUtcs.length; i++) {
    const breakdown = splitIntervalByTimeWindows(gapStartUtcs[i], gapEndUtcs[i], timezone);
    const totalMin = breakdown.totalMinutes;
    const nightMin = breakdown.noturnoMinutes;
    const dayMin = breakdown.diurnoMinutes;

    results.push({
      gapIndex: i,
      startUtc: gapStartUtcs[i],
      endUtc: gapEndUtcs[i],
      totalMinutes: totalMin,
      isDayGap: dayMin >= nightMin,
      isNightGap: nightMin > dayMin,
      diurnoMinutes: dayMin,
      noturnoMinutes: nightMin,
    });
  }

  return results;
}

/**
 * Classify duty segments: breaks duty into day/night/madrugada/wocl portions.
 */
export function classifyDutySegments(
  reportTimeUtc: string,
  endTimeUtc: string,
  timezone: string = 'America/Sao_Paulo'
): IntervalBreakdown {
  return splitIntervalByTimeWindows(reportTimeUtc, endTimeUtc, timezone);
}

/**
 * Determine if a duty is a "madrugada" duty (touches 00:00-06:00 local).
 */
export function isMadrugadaDuty(
  reportTimeUtc: string,
  endTimeUtc: string,
  timezone: string = 'America/Sao_Paulo'
): boolean {
  return calculateMadrugadaMinutes(reportTimeUtc, endTimeUtc, timezone) > 0;
}
