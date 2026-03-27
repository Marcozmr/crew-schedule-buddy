/**
 * Tipo visual da atividade do tripulante (ícone ao lado da função).
 * Tripulando em voo (bloco OP) vs extra/PS vs demais atividades — alinhado a `countsAsOperationalFlightBlockHours`.
 */

import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { countsAsOperationalFlightBlockHours } from '@/lib/operational-flight-hours';
import { getRosterEventVisualType } from '@/lib/roster/roster-calendar-visual';

export type CrewActivityVisualType =
  | 'flight'
  | 'extra_seat'
  | 'standby'
  | 'rest'
  | 'presentation'
  | 'course_like'
  | 'generic';

/** Em operação de voo (tripulando) — trecho de voo que conta como bloco operacional. */
export function isCrewOnFlightDuty(entry: ScheduleEntry): boolean {
  return entry.is_flight && countsAsOperationalFlightBlockHours(entry);
}

/**
 * Extra remunerado / reposicionamento (PS), EXTRA em solo, ou fora da tripulação ativa.
 */
export function isCrewOnExtraDuty(entry: ScheduleEntry): boolean {
  if (!entry.is_flight) {
    return getRosterEventVisualType(entry) === 'extra';
  }
  return !countsAsOperationalFlightBlockHours(entry);
}

export function getCrewActivityVisualType(entry: ScheduleEntry): CrewActivityVisualType {
  if (entry.is_flight) {
    if (countsAsOperationalFlightBlockHours(entry)) return 'flight';
    return 'extra_seat';
  }

  const rv = getRosterEventVisualType(entry);
  if (rv === 'extra') return 'extra_seat';
  if (rv === 'standby') return 'standby';
  if (rv === 'rest') return 'rest';
  if (rv === 'presentation') return 'presentation';
  if (
    rv === 'course' ||
    rv === 'simulator' ||
    rv === 'crm' ||
    rv === 'cma' ||
    rv === 'lgpd' ||
    rv === 'medical' ||
    rv === 'hotel'
  ) {
    return 'course_like';
  }
  return 'generic';
}

/** Texto curto para `title` / tooltip (PT). */
export function getCrewActivityTooltipPt(type: CrewActivityVisualType): string {
  switch (type) {
    case 'flight':
      return 'Tripulação ativa em operação de voo';
    case 'extra_seat':
      return 'Extra / fora da tripulação ativa (ex.: reposicionamento)';
    case 'standby':
      return 'Reserva ou sobreaviso';
    case 'rest':
      return 'Folga ou descanso';
    case 'presentation':
      return 'Apresentação';
    case 'course_like':
      return 'Atividade (curso, simulador, hotel, etc.)';
    case 'generic':
    default:
      return 'Atividade';
  }
}

/** Alias: mesmo resultado que `getCrewActivityVisualType` — combina com `<CrewActivityGlyph />`. */
export const getCrewActivityIcon = getCrewActivityVisualType;
