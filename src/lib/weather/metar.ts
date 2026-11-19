/**
 * METAR, TAF e SIGMET do aviationweather.gov. O serviço não manda cabeçalho de CORS, então o
 * navegador bloqueia a chamada direta: no app instalado vai pelo HTTP nativo do Capacitor; na web,
 * pela rota da Vercel `api/metar`.
 */
import { Capacitor, CapacitorHttp } from '@capacitor/core';

const AVIATIONWEATHER = 'https://aviationweather.gov/api/data';

export type AviationKind = 'metar' | 'taf' | 'sigmet';

export async function fetchAviationWeather(kind: AviationKind, icao?: string): Promise<string> {
  const ids = icao?.trim().toUpperCase();
  try {
    if (Capacitor.isNativePlatform()) {
      const url = `${AVIATIONWEATHER}/${kind}?${ids ? `ids=${ids}&` : ''}format=raw`;
      const r = await CapacitorHttp.get({ url, responseType: 'text' });
      return r.status === 200 ? String(r.data ?? '').trim() : '';
    }
    const path = kind === 'metar' ? `/api/metar?ids=${ids}` : `/api/metar?kind=${kind}${ids ? `&ids=${ids}` : ''}`;
    const r = await fetch(path);
    return r.ok ? (await r.text()).trim() : '';
  } catch {
    return '';
  }
}

export function fetchMetar(icao: string): Promise<string> {
  return fetchAviationWeather('metar', icao);
}

/** Temperatura do grupo "TT/DD" do METAR ("M02" = -2). */
export function metarTempC(raw: string): number | null {
  const m = String(raw ?? '').match(/\s(M?\d{2})\/(M?\d{2})?(?=\s|$)/);
  if (!m) return null;
  return m[1].startsWith('M') ? -Number(m[1].slice(1)) : Number(m[1]);
}
