import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({ now: {} as Record<string, unknown>, legs: {} as Record<string, unknown> }));
vi.mock('@/hooks/useAirportWeather', async (orig) => ({
  ...(await orig<typeof import('@/hooks/useAirportWeather')>()),
  useAirportWeather: () => ({ data: h.now, loading: false }),
}));
vi.mock('@/hooks/useLegWeather', async (orig) => ({
  ...(await orig<typeof import('@/hooks/useLegWeather')>()),
  useLegWeather: () => h.legs,
}));

import { WeatherStrip } from './WeatherStrip';

const renderStrip = (props: Parameters<typeof WeatherStrip>[0]) =>
  render(
    <MemoryRouter>
      <WeatherStrip {...props} />
    </MemoryRouter>,
  );

beforeEach(() => {
  h.now = { BSB: { iata: 'BSB', temp: 27, windSpeed: 6, windDir: 330, condition: 'Nublado', conditionEmoji: '☁️', flightCategory: 'VFR', metarRaw: '' } };
  h.legs = {
    next: { iata: 'REC', forecast: { iata: 'REC', at: '2026-03-20T20:00', temp: 28.6, condition: 'Pancadas de chuva', conditionEmoji: '🌦️', windKt: 11, windDir: 120 }, flightCategory: 'VFR', metarRaw: '' },
  };
});

describe('WeatherStrip', () => {
  it('mostra o tempo agora na base, a previsão do próximo pouso e o link do METAR/TAF', () => {
    renderStrip({ base: 'BSB', nextArrival: { iata: 'REC', date: '2026-03-20', time: '20:00' } });
    expect(screen.getByText(/Agora em BSB/)).toHaveTextContent('Agora em BSB 27°C');
    expect(screen.getByText(/Pouso em REC/)).toHaveTextContent('Pouso em REC 20:00 · 29°C');
    expect(screen.getByRole('link', { name: 'METAR/TAF' })).toHaveAttribute('href', '/weather');
  });

  it('sem previsão do pouso, não mostra o pouso', () => {
    h.legs = { next: { iata: 'REC', forecast: null, flightCategory: 'UNKN', metarRaw: '' } };
    renderStrip({ base: 'BSB', nextArrival: { iata: 'REC', date: '2027-01-20', time: '20:00' } });
    expect(screen.queryByText(/Pouso em REC/)).toBeNull();
    expect(screen.getByText(/Agora em BSB/)).toBeInTheDocument();
  });

  it('sem base e sem pouso, não aparece', () => {
    h.now = {};
    h.legs = {};
    const { container } = renderStrip({ base: null, nextArrival: null });
    expect(container).toBeEmptyDOMElement();
  });
});
