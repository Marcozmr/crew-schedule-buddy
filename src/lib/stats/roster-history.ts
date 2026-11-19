/**
 * Cada importação substitui a anterior como escala ativa, mas as linhas antigas continuam no banco.
 * Para as estatísticas de Ano e Sempre, junta todas as importações e, em cada dia, fica só com as
 * linhas da importação mais recente que cobre aquele dia. Se essa importação não tem linhas no dia
 * (voo trocado ou cancelado), o dia fica vazio. Importações com falha não contam.
 */
import type { ScheduleEntry } from '@/hooks/useScheduleData';

export interface RosterMeta {
  createdAt: string;
  start?: string | null;
  end?: string | null;
  failed?: boolean;
}

export function pickLatestPerDay(entries: ScheduleEntry[], rosters: Record<string, string | RosterMeta>): ScheduleEntry[] {
  const meta = (id: string | undefined): RosterMeta | undefined => {
    const r = id ? rosters[id] : undefined;
    return typeof r === 'string' ? { createdAt: r } : r;
  };
  const createdMs = (id: string | undefined) => {
    const iso = meta(id)?.createdAt;
    return iso ? Date.parse(iso) : Number.NEGATIVE_INFINITY;
  };
  const usable = entries.filter((e) => !meta(e.roster_id)?.failed);
  const covering = Object.keys(rosters).filter((id) => {
    const m = meta(id);
    return m && !m.failed && m.start && m.end;
  });
  const winner = new Map<string, string | undefined>();
  const consider = (date: string, id: string | undefined) => {
    if (!winner.has(date) || createdMs(id) > createdMs(winner.get(date))) winner.set(date, id);
  };
  for (const e of usable) {
    consider(e.date, e.roster_id);
    for (const id of covering) {
      const m = meta(id)!;
      if (e.date >= m.start! && e.date <= m.end!) consider(e.date, id);
    }
  }
  return usable
    .filter((e) => winner.get(e.date) === e.roster_id)
    .sort((a, b) => String(a.sort_datetime ?? a.date).localeCompare(String(b.sort_datetime ?? b.date)));
}
