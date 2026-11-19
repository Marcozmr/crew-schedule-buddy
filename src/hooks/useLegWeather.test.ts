import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ScheduleEntry } from '@/hooks/useScheduleData';

const h = vi.hoisted(() => ({ forecast: vi.fn(), metar: vi.fn() }));
vi.mock('@/lib/weather/forecast', () => ({ forecastAtArrival: h.forecast }));
vi.mock('@/lib/weather/metar', () => ({ fetchMetar: h.metar }));

import { legWeatherQuery, useLegWeather } from './useLegWeather';

const FORECAST = { iata: 'REC', at: '2026-03-20T20:00', temp: 26.1, condition: 'Pancadas de chuva', conditionEmoji: '🌦️', windKt: 11, windDir: 120 };

beforeEach(() => {
  h.forecast.mockReset();
  h.metar.mockReset();
});

describe('legWeatherQuery', () => {
  it('usa o destino, a data e a hora do pouso (dia seguinte quando passa da meia-noite)', () => {
    const leg = { id: 'l1', date: '2026-03-19', arrival: 'REC', arrival_airport: 'REC', arrival_time: '00:15', crosses_midnight: true } as ScheduleEntry;
    expect(legWeatherQuery(leg)).toEqual({ key: 'l1', iata: 'REC', date: '2026-03-20', time: '00:15' });
  });
});

describe('useLegWeather', () => {
  it('traz a previsão do pouso e a categoria do METAR do destino', async () => {
    h.forecast.mockResolvedValue(FORECAST);
    h.metar.mockResolvedValue('METAR SBRF 191500Z 12010KT 9999 BKN004 27/22 Q1012');
    const { result } = renderHook(() => useLegWeather([{ key: 'l1', iata: 'REC', date: '2026-03-20', time: '20:00' }]));
    await waitFor(() => expect(result.current.l1).toBeDefined());
    expect(result.current.l1.forecast).toEqual(FORECAST);
    expect(result.current.l1.flightCategory).toBe('LIFR');
    expect(h.forecast).toHaveBeenCalledWith('REC', '2026-03-20', '20:00');
    expect(h.metar).toHaveBeenCalledWith('SBRF');
  });

  it('sem previsão (fora da janela), forecast fica null', async () => {
    h.forecast.mockResolvedValue(null);
    h.metar.mockResolvedValue('');
    const { result } = renderHook(() => useLegWeather([{ key: 'l1', iata: 'REC', date: '2027-01-20', time: '20:00' }]));
    await waitFor(() => expect(result.current.l1).toBeDefined());
    expect(result.current.l1.forecast).toBeNull();
    expect(result.current.l1.flightCategory).toBe('UNKN');
  });

  it('sem pousos na lista, limpa o tempo anterior', async () => {
    h.forecast.mockResolvedValue(FORECAST);
    h.metar.mockResolvedValue('');
    const { result, rerender } = renderHook(({ q }) => useLegWeather(q), { initialProps: { q: [{ key: 'l1', iata: 'REC', date: '2026-03-20', time: '20:00' }] } });
    await waitFor(() => expect(result.current.l1).toBeDefined());
    rerender({ q: [] });
    await waitFor(() => expect(result.current).toEqual({}));
  });
});
