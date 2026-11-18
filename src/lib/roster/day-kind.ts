/**
 * Tipo de cada dia da escala (voo, folga, sobreaviso…) com a cor e a sigla mostradas na tela.
 * As cores vêm dos tokens --day-* de src/index.css.
 */
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { resolveCrewStatusFromActivityCode } from './crew-status-labels';

export type DayKind = 'voo' | 'folga' | 'sobreaviso' | 'reserva' | 'curso' | 'ferias' | 'dispensa' | 'outro' | 'vazio';

export const DAY_KIND_META: Record<DayKind, { label: string; sigla: string; className: string }> = {
  voo: { label: 'Voo', sigla: 'VOO', className: 'bg-day-voo text-day-voo-foreground' },
  folga: { label: 'Folga', sigla: 'FOL', className: 'bg-day-folga text-day-folga-foreground border border-border' },
  sobreaviso: { label: 'Sobreaviso', sigla: 'SOB', className: 'bg-day-sobreaviso text-day-sobreaviso-foreground' },
  reserva: { label: 'Reserva', sigla: 'RES', className: 'bg-day-reserva text-day-reserva-foreground' },
  curso: { label: 'Curso', sigla: 'CUR', className: 'bg-day-curso text-day-curso-foreground' },
  ferias: { label: 'Férias', sigla: 'FÉR', className: 'bg-day-ferias text-day-ferias-foreground' },
  dispensa: { label: 'Dispensa médica', sigla: 'MED', className: 'bg-day-dispensa text-day-dispensa-foreground' },
  outro: { label: 'Outro', sigla: '', className: 'bg-card text-muted-foreground border border-border' },
  vazio: { label: 'Sem escala', sigla: '', className: 'bg-transparent text-muted-foreground border border-dashed border-border' },
};

/** Ordem de prioridade quando o dia tem mais de um tipo de lançamento. */
const PRIORITY: DayKind[] = ['voo', 'reserva', 'sobreaviso', 'curso', 'dispensa', 'ferias', 'folga', 'outro'];

const BY_ENTRY_TYPE: Record<string, DayKind> = {
  flight: 'voo',
  day_off: 'folga',
  vacation: 'ferias',
  reserve: 'reserva',
  standby: 'sobreaviso',
  training: 'curso',
  sick: 'dispensa',
};

function kindOf(entry: ScheduleEntry): DayKind {
  if (entry.is_flight) return 'voo';
  const type = entry.entry_type ?? (entry.crew_status_code ? resolveCrewStatusFromActivityCode(entry.crew_status_code).entryType : null);
  return (type && BY_ENTRY_TYPE[type]) || 'outro';
}

export function dayKindForEntries(entries: ScheduleEntry[]): DayKind {
  if (entries.length === 0) return 'vazio';
  const kinds = new Set(entries.map(kindOf));
  return PRIORITY.find((k) => kinds.has(k)) ?? 'outro';
}
