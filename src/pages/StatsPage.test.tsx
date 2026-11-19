import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { entry, FEBRUARY_HISTORY, SAMPLE_MONTH } from '@/lib/stats/__fixtures__/sample-month';

const h = vi.hoisted(() => ({ homeBase: 'BSB' as string | null, prefsLoading: false, entries: null as unknown[] | null }));

vi.mock('@/components/AppLayout', () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/hooks/useRosterHistory', () => ({
  useRosterHistory: () => ({ entries: h.entries ?? [...FEBRUARY_HISTORY, ...SAMPLE_MONTH], loading: false, error: null, reload: () => {} }),
}));
vi.mock('@/hooks/useOperationalPreferences', () => ({
  useOperationalPreferences: () => ({ homeBase: h.homeBase, loading: h.prefsLoading, timezone: 'America/Sao_Paulo' }),
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
    expect(screen.getByText('Você estreou MAO no mês — já são 3 aeroportos operados.')).toBeInTheDocument();
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

describe('StatsPage — ajustes da revisão', () => {
  it('Qualidade de vida tem um emoji de acordo com cada frase', () => {
    renderPage();
    const text = document.body.textContent ?? '';
    expect(text).toContain('🏨 Pernoites programados');
    expect(text).toMatch(/(🎉|🙂|😓) Fins de semana livres/);
    expect(text).toContain('🏖️ Maior bloco de folga');
    expect(text).toMatch(/(💪|😮‍💨) Maior sequência de trabalho/);
    expect(text).toContain('🏠');
  });
  it('Descobertas também ganham emoji pelo assunto', () => {
    renderPage();
    expect(document.body.textContent).toMatch(/🌍\s*Voou/);
  });
  it('rótulo dos pousos tarde diz a janela certa', () => {
    renderPage();
    expect(screen.getByText('Pousos entre 23h e 06h')).toBeInTheDocument();
  });
  it('mês só com folgas mostra as seções em vez de "Sem voos"', () => {
    h.entries = [entry({ date: '2026-03-13', is_flight: false, activity_type: 'DO', entry_type: 'day_off' })];
    renderPage();
    expect(screen.queryByText('Sem voos neste mês')).toBeNull();
    expect(screen.getByText('Qualidade de vida')).toBeInTheDocument();
  });
  it('espera as preferências carregarem antes de calcular (sem piscar o convite da base)', () => {
    h.prefsLoading = true;
    h.homeBase = null;
    renderPage();
    expect(screen.queryByText('Em que cidade você mora?')).toBeNull();
    expect(screen.getByText(/Carregando estatísticas/)).toBeInTheDocument();
  });
});
