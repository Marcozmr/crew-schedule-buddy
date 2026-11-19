import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({ metar: vi.fn() }));
vi.mock('@/lib/weather/metar', async (orig) => ({ ...(await orig<typeof import('@/lib/weather/metar')>()), fetchMetar: h.metar }));

import { useAirportWeather } from './useAirportWeather';

afterEach(() => vi.restoreAllMocks());

describe('useAirportWeather (tempo de agora)', () => {
  it('vento em nós, condição correta e temperatura do METAR quando existe', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ current: { temperature_2m: 25.2, wind_speed_10m: 7, wind_direction_10m: 330, weather_code: 80 } })));
    h.metar.mockResolvedValue('METAR SBBR 191500Z 33006KT 9999 BKN030 27/18 Q1018');
    const { result } = renderHook(() => useAirportWeather(['BSB']));
    await waitFor(() => expect(result.current.data.BSB).toBeDefined());
    expect(String(fetchMock.mock.calls[0][0])).toContain('wind_speed_unit=kn');
    expect(result.current.data.BSB.temp).toBe(27);
    expect(result.current.data.BSB.windSpeed).toBe(7);
    expect(result.current.data.BSB.condition).toBe('Pancadas de chuva');
    expect(result.current.data.BSB.flightCategory).toBe('VFR');
  });

  it('aeroporto fora da tabela antiga (CAC) também tem tempo', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ current: { temperature_2m: 22, wind_speed_10m: 5, wind_direction_10m: 0, weather_code: 0 } })));
    h.metar.mockResolvedValue('');
    const { result } = renderHook(() => useAirportWeather(['CAC']));
    await waitFor(() => expect(result.current.data.CAC).toBeDefined());
    expect(result.current.data.CAC.temp).toBe(22);
  });
});
