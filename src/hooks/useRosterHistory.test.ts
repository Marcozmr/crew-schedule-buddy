import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  rosters: [] as Array<{ id: string; created_at: string }>,
  entries: [] as Array<Record<string, unknown>>,
  ranges: [] as Array<[number, number]>,
  orders: [] as string[],
}));

vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/integrations/supabase/client', () => {
  const table = (name: string) => {
    const q = {
      select: () => q,
      eq: () => q,
      order: (col: string) => {
        if (name === 'schedule_entries') h.orders.push(col);
        return q;
      },
      range: async (from: number, to: number) => {
        h.ranges.push([from, to]);
        return { data: h.entries.slice(from, to + 1), error: null };
      },
      then: (resolve: (v: unknown) => void) => resolve({ data: name === 'imported_rosters' ? h.rosters : [], error: null }),
    };
    return q;
  };
  return { supabase: { from: (name: string) => table(name) } };
});

import { useRosterHistory } from './useRosterHistory';

function entry(id: string, rosterId: string, date: string) {
  return { id, roster_id: rosterId, date, sort_datetime: `${date}T08:00:00` };
}

beforeEach(() => {
  h.ranges = [];
  h.orders = [];
  h.rosters = [
    { id: 'out', created_at: '2026-10-01T00:00:00Z' },
    { id: 'nov', created_at: '2026-11-19T00:00:00Z' },
  ];
  h.entries = [entry('o1', 'out', '2026-10-30'), entry('o2', 'out', '2026-11-02'), entry('n1', 'nov', '2026-11-02')];
});

describe('useRosterHistory', () => {
  it('junta todas as importações ficando com a mais recente de cada dia', async () => {
    const { result } = renderHook(() => useRosterHistory());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries.map((e) => e.id)).toEqual(['o1', 'n1']);
    expect(result.current.error).toBeNull();
  });

  it('busca em páginas de 1000 linhas até acabar', async () => {
    h.entries = Array.from({ length: 1500 }, (_, i) => entry(`e${i}`, 'nov', `2026-11-${String((i % 28) + 1).padStart(2, '0')}`));
    const { result } = renderHook(() => useRosterHistory());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(h.ranges).toEqual([[0, 999], [1000, 1999]]);
    expect(result.current.entries).toHaveLength(1500);
  });

  it('recarrega quando a escala é atualizada', async () => {
    const { result } = renderHook(() => useRosterHistory());
    await waitFor(() => expect(result.current.loading).toBe(false));
    h.entries.push(entry('n2', 'nov', '2026-11-03'));
    act(() => {
      window.dispatchEvent(new CustomEvent('escalax:roster-updated', { detail: { userId: 'u1', reason: 'portal_sync_auto', at: '' } }));
    });
    await waitFor(() => expect(result.current.entries.map((e) => e.id)).toContain('n2'));
  });

  it('desempata a paginação pelo id (sort_datetime se repete entre importações)', async () => {
    const { result } = renderHook(() => useRosterHistory());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(h.orders).toEqual(['sort_datetime', 'id']);
  });
});
