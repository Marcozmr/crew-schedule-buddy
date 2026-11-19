import { useState, useEffect, useRef } from 'react';
import { getAirport } from '@/lib/airports';
import { fetchMetar, metarTempC } from '@/lib/weather/metar';
import { wmoCondition } from '@/lib/weather/wmo';

export interface AirportWeather {
  iata: string;
  temp: number | null;
  windSpeed: number | null;
  windDir: number | null;
  condition: string;
  conditionEmoji: string;
  flightCategory: 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKN';
  metarRaw: string;
}

const FC_COLOR: Record<AirportWeather['flightCategory'], string> = {
  VFR:  'bg-green-500/20 text-green-400 border-green-500/30',
  MVFR: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  IFR:  'bg-red-500/20 text-red-400 border-red-500/30',
  LIFR: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  UNKN: 'bg-muted text-muted-foreground border-border',
};
export { FC_COLOR };

export function parseFlightCategory(metar: string): AirportWeather['flightCategory'] {
  if (!metar) return 'UNKN';
  let ceilingFt = 99999;
  for (const m of metar.matchAll(/\b(BKN|OVC|VV)(\d{3})\b/g)) {
    ceilingFt = Math.min(ceilingFt, parseInt(m[2]) * 100);
  }
  // Visibility in meters (4-digit)
  const visM = metar.match(/\b(\d{4})\b/);
  let visSM = 99;
  if (visM) visSM = parseInt(visM[1]) / 1609;
  // Visibility in SM
  const visSMMatch = metar.match(/\s(\d+(?:\/\d+)?)\s*SM\b/);
  if (visSMMatch) {
    const parts = visSMMatch[1].split('/');
    visSM = parts.length === 2 ? parseInt(parts[0]) / parseInt(parts[1]) : parseInt(parts[0]);
  }
  if (ceilingFt < 500 || visSM < 1) return 'LIFR';
  if (ceilingFt < 1000 || visSM < 3) return 'IFR';
  if (ceilingFt < 3000 || visSM < 5) return 'MVFR';
  return 'VFR';
}

export function useAirportWeather(iataCodes: string[]) {
  const [data, setData] = useState<Record<string, AirportWeather>>({});
  const [loading, setLoading] = useState(false);
  const prevKeyRef = useRef('');

  const key = [...new Set(iataCodes.filter(Boolean).map(c => c.trim().toUpperCase()).filter(c => getAirport(c)))].sort().join(',');

  useEffect(() => {
    if (!key || key === prevKeyRef.current) return;
    prevKeyRef.current = key;
    const codes = key.split(',');
    setLoading(true);

    Promise.all(codes.map(async (iata) => {
      const apt = getAirport(iata);
      if (!apt) return null;
      try {
        const [wxResult, metarResult] = await Promise.allSettled([
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${apt.lat}&longitude=${apt.lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code&wind_speed_unit=kn&timezone=auto`).then(r => r.json()),
          fetchMetar(apt.icao),
        ]);
        const wx = wxResult.status === 'fulfilled' ? wxResult.value : null;
        const metarRaw = metarResult.status === 'fulfilled' ? (metarResult.value as string).trim() : '';
        const c = wx?.current;
        const cond = wmoCondition(c?.weather_code ?? -1);
        // Temperatura observada (METAR) vale mais que a estimada pelo modelo.
        const observed = metarTempC(metarRaw);
        return [iata, {
          iata,
          temp: observed ?? c?.temperature_2m ?? null,
          windSpeed: c?.wind_speed_10m ?? null,
          windDir: c?.wind_direction_10m ?? null,
          condition: cond.label,
          conditionEmoji: cond.emoji,
          flightCategory: parseFlightCategory(metarRaw),
          metarRaw,
        }] as [string, AirportWeather];
      } catch {
        return null;
      }
    })).then(results => {
      const map: Record<string, AirportWeather> = {};
      results.forEach(r => { if (r) map[r[0]] = r[1]; });
      setData(map);
      setLoading(false);
    });
  }, [key]);

  return { data, loading };
}
