/**
 * Classificação visual de eventos da escala no calendário (ícones discretos, tom profissional).
 */

import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { isPresentationEntry } from '@/lib/schedule-entry-sort';

export type RosterCalendarVisualType =
  | 'flight'
  | 'extra'
  | 'standby'
  | 'rest'
  | 'course'
  | 'simulator'
  | 'crm'
  | 'cma'
  | 'lgpd'
  | 'medical'
  | 'hotel'
  | 'presentation'
  | 'generic';

/**
 * Mapeia uma linha da escala para um tipo visual consistente (ícone + cor no calendário).
 */
export function getRosterEventVisualType(entry: ScheduleEntry): RosterCalendarVisualType {
  if (entry.is_flight) return 'flight';
  if (isPresentationEntry(entry)) return 'presentation';

  const at = (entry.activity_type || '').toUpperCase();
  const label = (entry.activity_label || entry.raw_line || '').toUpperCase();

  if (['DO', 'FOLGA', 'OFF', 'X', 'DSO', 'LV'].includes(at)) return 'rest';
  if (['EXTRA', 'EXTR', 'EXB', 'EXBD'].includes(at) || at.includes('EXTRA')) return 'extra';
  if (['HSB', 'HSBE', 'ASB', 'RES', 'SBV', 'STBY', 'RSP'].includes(at)) return 'standby';
  if (['SIM', 'SIMU', 'FBS', 'DIF'].includes(at) || label.includes('SIMUL')) return 'simulator';
  if (at.includes('CRM') || label.includes('CRM')) return 'crm';
  if (at.includes('CMA') || label.includes('CMA')) return 'cma';
  if (at.includes('LGPD') || label.includes('LGPD')) return 'lgpd';
  if (['AEM', 'MED', 'PCMSO', 'ASO'].includes(at) || label.includes('MÉD') || label.includes('MED')) {
    return 'medical';
  }
  if (
    ['CURSO', 'CRS', 'TREIN', 'EAD', 'CBT'].some((k) => at.includes(k) || label.includes(k))
  ) {
    return 'course';
  }
  if (entry.hotel_name || at === 'HOTEL' || at === 'HTL') return 'hotel';

  return 'generic';
}
