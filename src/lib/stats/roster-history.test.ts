import { describe, expect, it } from 'vitest';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { pickLatestPerDay } from './roster-history';

function e(id: string, rosterId: string, date: string, time: string): ScheduleEntry {
  return { id, roster_id: rosterId, date, sort_datetime: `${date}T${time}:00` } as ScheduleEntry;
}

describe('pickLatestPerDay', () => {
  const createdAt = { velha: '2026-11-01T10:00:00Z', nova: '2026-11-19T15:00:00Z' };

  it('dia presente nas duas importações fica com a mais recente', () => {
    const out = pickLatestPerDay(
      [e('a', 'velha', '2026-11-05', '08:00'), e('b', 'nova', '2026-11-05', '09:00'), e('c', 'nova', '2026-11-05', '07:00')],
      createdAt,
    );
    expect(out.map((x) => x.id)).toEqual(['c', 'b']);
  });

  it('dia que só existe na importação antiga continua', () => {
    const out = pickLatestPerDay([e('a', 'velha', '2026-10-28', '08:00'), e('b', 'nova', '2026-11-05', '09:00')], createdAt);
    expect(out.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('importação sem data de criação conhecida perde para a conhecida', () => {
    const out = pickLatestPerDay([e('a', 'sumida', '2026-11-05', '08:00'), e('b', 'velha', '2026-11-05', '09:00')], createdAt);
    expect(out.map((x) => x.id)).toEqual(['b']);
  });
});

describe('pickLatestPerDay — importação que cobre o dia', () => {
  const rosters = {
    velha: { createdAt: '2026-11-01T10:00:00Z', start: '2026-11-01', end: '2026-11-30' },
    nova: { createdAt: '2026-11-19T15:00:00Z', start: '2026-11-01', end: '2026-11-30' },
    falhou: { createdAt: '2026-11-20T15:00:00Z', start: '2026-11-01', end: '2026-11-30', failed: true },
  };
  it('voo que saiu da escala nova não continua contando', () => {
    const out = pickLatestPerDay([e('a', 'velha', '2026-11-05', '08:00'), e('b', 'nova', '2026-11-06', '09:00')], rosters);
    expect(out.map((x) => x.id)).toEqual(['b']);
  });
  it('importação com falha é ignorada', () => {
    const out = pickLatestPerDay([e('a', 'nova', '2026-11-05', '08:00'), e('b', 'falhou', '2026-11-05', '09:00')], rosters);
    expect(out.map((x) => x.id)).toEqual(['a']);
  });
});
