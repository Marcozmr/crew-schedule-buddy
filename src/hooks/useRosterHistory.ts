/**
 * Todas as linhas de escala da usuária, de todas as importações, ficando com a mais recente de cada
 * dia (ver pickLatestPerDay). Base das estatísticas de Mês, Ano e Sempre.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { subscribeRosterUpdated } from '@/lib/events/roster-events';
import { pickLatestPerDay, type RosterMeta } from '@/lib/stats/roster-history';
import type { ScheduleEntry } from '@/hooks/useScheduleData';

const PAGE = 1000;

async function loadAll(userId: string): Promise<ScheduleEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colunas novas ainda não estão nos tipos gerados
  const { data: rosters, error: rostersError } = await (supabase.from('imported_rosters') as any)
    .select('id, created_at, roster_start_date, roster_end_date, import_status')
    .eq('user_id', userId);
  if (rostersError) throw new Error(rostersError.message);
  type Row = { id: string; created_at: string; roster_start_date?: string | null; roster_end_date?: string | null; import_status?: string | null };
  const meta: Record<string, RosterMeta> = Object.fromEntries(
    ((rosters ?? []) as Row[]).map((r) => [
      r.id,
      { createdAt: r.created_at, start: r.roster_start_date ?? null, end: r.roster_end_date ?? null, failed: r.import_status === 'failed' },
    ]),
  );

  const rows: ScheduleEntry[] = [];
  for (let from = 0; ; from += PAGE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('schedule_entries') as any)
      .select('*')
      .eq('user_id', userId)
      .order('sort_datetime', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as ScheduleEntry[]));
    if (!data || data.length < PAGE) break;
  }
  return pickLatestPerDay(rows, meta);
}

export function useRosterHistory(): { entries: ScheduleEntry[]; loading: boolean; error: string | null; reload(): void } {
  const { user } = useAuth();
  const userId = user?.id;
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => subscribeRosterUpdated(() => reload()), [reload]);

  useEffect(() => {
    if (!userId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadAll(userId)
      .then((rows) => {
        if (cancelled) return;
        setEntries(rows);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, version]);

  return { entries, loading, error, reload };
}
