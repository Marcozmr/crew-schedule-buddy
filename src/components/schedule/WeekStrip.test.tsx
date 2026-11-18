import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { WeekStrip } from './WeekStrip';

function entry(date: string, partial: Partial<ScheduleEntry>): ScheduleEntry {
  return { id: `${date}-${Math.random()}`, date, is_flight: false, entry_type: null, crew_status_code: null, ...partial } as unknown as ScheduleEntry;
}

const TODAY = new Date(2026, 10, 18, 13, 5); // qua, 18/11/2026

const SCHEDULE = [
  entry('2026-11-18', { is_flight: true }),
  entry('2026-11-20', { entry_type: 'standby' }),
  entry('2026-11-21', { entry_type: 'reserve' }),
];

describe('WeekStrip', () => {
  it('mostra 7 dias a partir de hoje, com a sigla de cada tipo', () => {
    render(<WeekStrip schedule={SCHEDULE} today={TODAY} onSelectDay={() => {}} />);
    const days = screen.getAllByRole('button');

    expect(days).toHaveLength(7);
    expect(days[0]).toHaveTextContent('18');
    expect(days[0]).toHaveTextContent('VOO');
    expect(days[1]).toHaveTextContent('19');
    expect(days[1]).not.toHaveTextContent(/VOO|FOL|SOB|RES/);
    expect(days[2]).toHaveTextContent('SOB');
    expect(days[3]).toHaveTextContent('RES');
    expect(days[6]).toHaveTextContent('24');
  });

  it('marca hoje', () => {
    render(<WeekStrip schedule={SCHEDULE} today={TODAY} onSelectDay={() => {}} />);
    const days = screen.getAllByRole('button');

    expect(days[0]).toHaveAttribute('aria-current', 'date');
    expect(days[1]).not.toHaveAttribute('aria-current');
  });

  it('tocar num dia avisa qual data foi escolhida', () => {
    const onSelectDay = vi.fn();
    render(<WeekStrip schedule={SCHEDULE} today={TODAY} onSelectDay={onSelectDay} />);
    fireEvent.click(screen.getAllByRole('button')[3]);

    const picked: Date = onSelectDay.mock.calls[0][0];
    expect([picked.getFullYear(), picked.getMonth(), picked.getDate()]).toEqual([2026, 10, 21]);
  });
});
