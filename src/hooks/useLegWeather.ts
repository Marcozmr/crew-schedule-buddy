/**
 * Tempo de cada pouso: previsão para a hora do pouso (Open-Meteo, no fuso do destino) e a categoria
 * de voo atual do destino (METAR). Sem previsão (fora da janela), `forecast` fica null e a tela não
 * mostra temperatura.
 */
import { useEffect, useMemo, useState } from 'react';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { getAirport } from '@/lib/airports';
import { forecastAtArrival, type LegForecast } from '@/lib/weather/forecast';
import { fetchMetar } from '@/lib/weather/metar';
import { parseFlightCategory, type AirportWeather } from '@/hooks/useAirportWeather';

export interface LegWeatherQuery {
  key: string;
  iata: string;
  date: string;
  time: string;
}

export interface LegWeather {
  iata: string;
  forecast: LegForecast | null;
  flightCategory: AirportWeather['flightCategory'];
  metarRaw: string;
}

function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Pergunta de tempo para o pouso de uma perna (data do pouso considera a virada da meia-noite). */
export function legWeatherQuery(leg: ScheduleEntry): LegWeatherQuery | null {
  const iata = String(leg.arrival_airport || leg.arrival || '').trim().toUpperCase().slice(0, 3);
  if (!iata || !leg.arrival_time) return null;
  return { key: leg.id, iata, date: leg.crosses_midnight ? nextDay(leg.date) : leg.date, time: leg.arrival_time };
}

export function useLegWeather(queries: LegWeatherQuery[]): Record<string, LegWeather> {
  const [data, setData] = useState<Record<string, LegWeather>>({});
  const signature = useMemo(() => queries.map((q) => `${q.key}|${q.iata}|${q.date}|${q.time}`).join(';'), [queries]);

  useEffect(() => {
    if (!signature) return;
    let cancelled = false;
    const metarByIata = new Map<string, Promise<string>>();
    const metarFor = (iata: string) => {
      const icao = getAirport(iata)?.icao;
      if (!icao) return Promise.resolve('');
      if (!metarByIata.has(iata)) metarByIata.set(iata, fetchMetar(icao));
      return metarByIata.get(iata)!;
    };
    void Promise.all(
      queries.map(async (q) => {
        const [forecast, metarRaw] = await Promise.all([forecastAtArrival(q.iata, q.date, q.time), metarFor(q.iata)]);
        return [q.key, { iata: q.iata, forecast, flightCategory: parseFlightCategory(metarRaw), metarRaw }] as const;
      }),
    ).then((rows) => {
      if (!cancelled) setData(Object.fromEntries(rows));
    });
    return () => {
      cancelled = true;
    };
    // `signature` resume `queries`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return data;
}
