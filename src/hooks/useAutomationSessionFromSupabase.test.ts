import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const h = vi.hoisted(() => {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: async () => ({ data: [], error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
  };
  const channel = { on: () => channel, subscribe: () => channel };
  return { from: vi.fn(() => query), channel: vi.fn(() => channel), removeChannel: vi.fn(async () => undefined) };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: h.from, channel: h.channel, removeChannel: h.removeChannel },
}));

import { useAutomationSessionFromSupabase } from './useAutomationSessionFromSupabase';

afterEach(() => vi.useRealTimers());

describe('useAutomationSessionFromSupabase', () => {
  it('não consulta o banco a cada poucos segundos: o tempo real avisa as mudanças', async () => {
    vi.useFakeTimers();
    renderHook(() => useAutomationSessionFromSupabase('u1'));
    await vi.advanceTimersByTimeAsync(0);
    const afterMount = h.from.mock.calls.length;

    await vi.advanceTimersByTimeAsync(30_000);

    expect(h.from.mock.calls.length).toBe(afterMount);
  });
});
