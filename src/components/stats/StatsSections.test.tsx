import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { computeRosterStats } from '@/lib/stats/compute';
import { MARCH_PERIOD, SAMPLE_MONTH } from '@/lib/stats/__fixtures__/sample-month';
import { SummarySection } from './StatsSections';

describe('SummarySection', () => {
  it('eficiência acima de 100% (PDF sem jornada) não passa de 10h no texto', () => {
    const base = computeRosterStats({ entries: SAMPLE_MONTH, history: SAMPLE_MONTH, period: MARCH_PERIOD, base: 'BSB' });
    render(<SummarySection stats={{ ...base, summary: { ...base.summary, efficiency: 1.3 } }} />);
    expect(screen.getByText(/De cada 10h de jornada, 10h00 voando/)).toBeInTheDocument();
  });
});
