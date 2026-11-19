import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { FEBRUARY_HISTORY, SAMPLE_MONTH } from '@/lib/stats/__fixtures__/sample-month';

const h = vi.hoisted(() => ({ homeBase: 'BSB' as string | null }));

vi.mock('@/components/AppLayout', () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/hooks/useRosterHistory', () => ({
  useRosterHistory: () => ({ entries: [...FEBRUARY_HISTORY, ...SAMPLE_MONTH], loading: false, error: null, reload: () => {} }),
}));
vi.mock('@/hooks/useOperationalPreferences', () => ({
  useOperationalPreferences: () => ({ homeBase: h.homeBase, loading: false, timezone: 'America/Sao_Paulo' }),
}));

import StatsPage from './StatsPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <StatsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.homeBase = 'BSB';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-15T12:00:00'));
});
afterEach(() => vi.useRealTimers());

describe('StatsPage', () => {
  it('mostra as seções do mês atual com os números da escala', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Estatísticas' })).toBeInTheDocument();
    expect(screen.getByText('março de 2026')).toBeInTheDocument();
    for (const title of ['Resumo', 'Qualidade de vida', 'Voos', 'Aeroportos', 'Aeronaves', 'Descobertas']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    expect(screen.getByText('10:30')).toBeInTheDocument(); // horas voadas (630 min)
    expect(screen.getByText('Você estreou MAO este mês — já são 3 aeroportos operados.')).toBeInTheDocument();
  });

  it('aba Ano soma os meses do ano (fevereiro + março)', () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Ano' }));
    expect(screen.getByText('2026')).toBeInTheDocument();
    expect(screen.getByText('13:30')).toBeInTheDocument(); // 630 + 180 min voados
    // Sem histórico antes de 2026, nada é "estreado" no ano.
    expect(screen.queryByText(/estreou/)).toBeNull();
  });

  it('mês sem voos mostra o aviso', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Período anterior' }));
    fireEvent.click(screen.getByRole('button', { name: 'Período anterior' }));
    expect(screen.getByText('janeiro de 2026')).toBeInTheDocument();
    expect(screen.getByText('Sem voos neste mês')).toBeInTheDocument();
  });

  it('sem base no perfil, convida a informar a cidade', () => {
    h.homeBase = null;
    renderPage();
    expect(screen.getByText('Em que cidade você mora?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Informar no perfil' })).toHaveAttribute('href', '/settings');
  });
});
