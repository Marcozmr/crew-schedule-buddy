import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearForecastCache, forecastAtArrival, pickHourly } from './forecast';

const HOURLY = {
  time: ['2026-03-20T19:00', '2026-03-20T20:00', '2026-03-20T21:00'],
  temperature_2m: [27.4, 26.1, 25.0],
  weather_code: [2, 80, 3],
  wind_speed_10m: [8, 11, 9],
  wind_direction_10m: [90, 120, 150],
};

afterEach(() => {
  vi.restoreAllMocks();
  clearForecastCache();
});

describe('pickHourly', () => {
  it('pega a hora mais próxima do pouso', () => {
    expect(pickHourly(HOURLY, '2026-03-20', '20:10')).toEqual({ temp: 26.1, code: 80, windKt: 11, windDir: 120 });
    expect(pickHourly(HOURLY, '2026-03-20', '20:40')?.temp).toBe(25.0);
  });
  it('sem a hora pedida devolve null', () => {
    expect(pickHourly(HOURLY, '2026-03-21', '20:00')).toBeNull();
  });
});

describe('forecastAtArrival', () => {
  const now = new Date('2026-03-19T15:00:00Z');

  it('pede a previsão por hora no fuso do aeroporto, com vento em nós', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ hourly: HOURLY })));
    const f = await forecastAtArrival('REC', '2026-03-20', '20:00', now);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('wind_speed_unit=kn');
    expect(url).toContain('timezone=America%2FRecife');
    expect(url).toContain('start_date=2026-03-20');
    expect(f).toMatchObject({ iata: 'REC', temp: 26.1, windKt: 11, condition: 'Pancadas de chuva', at: '2026-03-20T20:00' });
  });

  it('pouso além de 16 dias: sem previsão (nunca a temperatura de hoje)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    expect(await forecastAtArrival('REC', '2026-12-20', '20:00', now)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pouso que já passou: sem previsão', async () => {
    expect(await forecastAtArrival('REC', '2026-03-18', '20:00', now)).toBeNull();
  });

  it('aeroporto desconhecido ou falha de rede: null', async () => {
    expect(await forecastAtArrival('XYZ', '2026-03-20', '20:00', now)).toBeNull();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    expect(await forecastAtArrival('REC', '2026-03-20', '20:00', now)).toBeNull();
  });
});

describe('forecastAtArrival — cache', () => {
  const now = new Date('2026-03-19T15:00:00Z');
  const ok = () => new Response(JSON.stringify({ hourly: HOURLY }));

  it('resposta com erro não fica guardada: tenta de novo na próxima vez', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('x', { status: 500 })).mockResolvedValueOnce(ok());
    expect(await forecastAtArrival('REC', '2026-03-20', '20:00', now)).toBeNull();
    expect(await forecastAtArrival('REC', '2026-03-20', '20:00', now)).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('previsão guardada vale por 1 hora', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-19T15:00:00Z'));
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ok());
    await forecastAtArrival('REC', '2026-03-20', '20:00', now);
    vi.setSystemTime(new Date('2026-03-19T15:30:00Z'));
    await forecastAtArrival('REC', '2026-03-20', '20:00', now);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date('2026-03-19T16:01:00Z'));
    await forecastAtArrival('REC', '2026-03-20', '20:00', now);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
