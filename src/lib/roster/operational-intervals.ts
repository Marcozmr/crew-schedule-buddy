/**
 * Durações operacionais e descanso entre jornadas — formatação e regras de negócio em PT.
 */

import type { DutyPeriod } from '@/lib/duty-grouping';
import {
  findNextChronologicalDuty,
  getDutyOperationalEndAbsoluteMin,
  getGroundIntervalBetweenLegs,
} from '@/lib/duty-grouping';

export { getGroundIntervalBetweenLegs };

/** Ex.: 0h45, 1h20, 12h05 */
export function formatOperationalDuration(totalMinutes: number): string {
  const m = Math.round(totalMinutes);
  if (!Number.isFinite(m) || m < 0) return '—';
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h${String(mm).padStart(2, '0')}`;
}

/**
 * Descanso entre o fim operacional desta jornada e a apresentação da próxima jornada na escala.
 * Retorna null se não houver próxima jornada ou se os tempos forem incoerentes.
 */
export function getRestUntilNextPresentation(
  current: DutyPeriod,
  sortedAllDuties: DutyPeriod[],
): { minutes: number; nextDuty: DutyPeriod } | null {
  const next = findNextChronologicalDuty(sortedAllDuties, current);
  if (!next) return null;
  const end = getDutyOperationalEndAbsoluteMin(current);
  const start = next.dutyStartAbsoluteMin;
  const gap = start - end;
  if (!Number.isFinite(gap) || gap <= 0) return null;
  return { minutes: gap, nextDuty: next };
}
