/**
 * Ordenação operacional única — prioriza `sort_datetime` (parser / import),
 * depois data + horário de report/partida. Usar em calendário, listas e fallbacks de UI.
 */

import type { ScheduleEntry } from '@/hooks/useScheduleData';

function padHHmm(t: string): string {
  const p = t.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!p) return '00:00';
  return `${p[1].padStart(2, '0')}:${p[2]}`;
}

/**
 * Chave ISO local comparável (lexicográfica) para ordenar eventos no mesmo dia e entre dias.
 */
export function operationalSortKey(e: ScheduleEntry): string {
  const raw = e.sort_datetime?.trim();
  if (raw && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
    return raw.replace(/[Z+-]\d{2}:?\d{2}$/, '').replace(/[Z+-]\d{4}$/, '').slice(0, 19);
  }
  const t = padHHmm(e.report_time || e.departure_time || '00:00');
  return `${e.date}T${t}:00`;
}

export function compareScheduleEntries(a: ScheduleEntry, b: ScheduleEntry): number {
  const c = operationalSortKey(a).localeCompare(operationalSortKey(b));
  if (c !== 0) return c;
  return a.id.localeCompare(b.id);
}

/** Apresentação (APR) — entra na jornada antes do voo quando o horário for anterior. */
export function isPresentationEntry(e: ScheduleEntry): boolean {
  if (e.is_flight) return false;
  const et = (e.entry_type || '').toLowerCase();
  if (et === 'duty_start') return true;
  const at = (e.activity_type || '').toUpperCase();
  if (at === 'APR') return true;
  if ((e.crew_status_code || '').toUpperCase() === 'APR') return true;
  return false;
}
