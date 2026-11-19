/**
 * Previsão do tempo para a HORA DO POUSO (não a de agora), pelo Open-Meteo, no fuso do aeroporto.
 * Fora da janela de previsão (passado ou mais de 16 dias), não devolve nada.
 */
import { getAirport } from '@/lib/airports';
import { localToUtcMs } from '@/lib/stats/time';
import { wmoCondition } from './wmo';

export const FORECAST_WINDOW_DAYS = 16;

export interface Hourly {
  time: string[];
  temperature_2m: Array<number | null>;
  weather_code: Array<number | null>;
  wind_speed_10m: Array<number | null>;
  wind_direction_10m: Array<number | null>;
}

export interface LegForecast {
  iata: string;
  /** Hora local da previsão usada, "YYYY-MM-DDTHH:00". */
  at: string;
  temp: number;
  condition: string;
  conditionEmoji: string;
  windKt: number | null;
  windDir: number | null;
}

/** Hora cheia mais próxima ("20:40" → 21), sem passar das 23h. */
function nearestHour(hhmm: string): number | null {
  const m = String(hhmm ?? '').match(/^(\d{1,2}):(\d{2})/);
  return m ? Math.min(23, Number(m[1]) + (Number(m[2]) >= 30 ? 1 : 0)) : null;
}

const hourKey = (date: string, hour: number) => `${date}T${String(hour).padStart(2, '0')}:00`;

/** Valores da hora local mais próxima de `hhmm` no dia `date`. */
export function pickHourly(
  hourly: Hourly,
  date: string,
  hhmm: string,
): { temp: number; code: number; windKt: number | null; windDir: number | null } | null {
  const hour = nearestHour(hhmm);
  if (hour == null) return null;
  const idx = hourly.time.indexOf(hourKey(date, hour));
  const temp = idx >= 0 ? hourly.temperature_2m[idx] : null;
  if (idx < 0 || temp == null) return null;
  return {
    temp,
    code: hourly.weather_code[idx] ?? -1,
    windKt: hourly.wind_speed_10m[idx] ?? null,
    windDir: hourly.wind_direction_10m[idx] ?? null,
  };
}

/** Previsão guardada por 1 h (o app pode ficar aberto por dias). Falha ou resposta com erro não fica guardada. */
const FORECAST_TTL_MS = 3_600_000;
const cache = new Map<string, { at: number; p: Promise<Hourly | null> }>();

export function clearForecastCache(): void {
  cache.clear();
}

function hourlyFor(iata: string, date: string): Promise<Hourly | null> {
  const key = `${iata}|${date}`;
  const hit = cache.get(key);
  let p = hit && Date.now() - hit.at < FORECAST_TTL_MS ? hit.p : undefined;
  if (!p) {
    const apt = getAirport(iata)!;
    const params = new URLSearchParams({
      latitude: String(apt.lat),
      longitude: String(apt.lon),
      hourly: 'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m',
      wind_speed_unit: 'kn',
      timezone: apt.tz,
      start_date: date,
      end_date: date,
    });
    p = fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.hourly as Hourly) ?? null)
      .catch(() => null)
      .then((h) => {
        if (!h) cache.delete(key);
        return h;
      });
    cache.set(key, { at: Date.now(), p });
  }
  return p;
}

export async function forecastAtArrival(iata: string, date: string, hhmm: string, now: Date = new Date()): Promise<LegForecast | null> {
  const code = iata.trim().toUpperCase();
  const apt = getAirport(code);
  const hour = nearestHour(hhmm);
  if (!apt || hour == null) return null;
  const arrivalUtc = localToUtcMs(date, hhmm, apt.tz);
  if (arrivalUtc < now.getTime() - 3_600_000 || arrivalUtc > now.getTime() + FORECAST_WINDOW_DAYS * 86_400_000) return null;
  const hourly = await hourlyFor(code, date);
  const v = hourly ? pickHourly(hourly, date, hhmm) : null;
  if (!v) return null;
  const cond = wmoCondition(v.code);
  return {
    iata: code,
    at: hourKey(date, hour),
    temp: v.temp,
    condition: cond.label,
    conditionEmoji: cond.emoji,
    windKt: v.windKt,
    windDir: v.windDir,
  };
}
