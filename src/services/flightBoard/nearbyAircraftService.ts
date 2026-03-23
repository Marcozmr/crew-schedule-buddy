/**
 * Serviço de aeronaves próximas (OpenSky Network)
 * Cache: 5 min. Fallback: array vazio.
 *
 * NOTA: Não associar aeronaves OpenSky a voos sem correspondência confiável
 * (callsign + flight number + janela de horário). Este serviço retorna dados
 * independentes para uso em mapa/tracking, não para mesclar com Flight Board.
 */

import {
  getOpenSkyNearbyAircraft,
  type OpenSkyAircraftNormalized,
} from "./providers/openskyProvider";
import { getFromCache, setInCache, cacheKeys } from "./flightCache";

export type { OpenSkyAircraftNormalized as NearbyAircraft };

export interface NearbyAircraftOptions {
  /** Bounding box: lamin, lomin, lamax, lomax (WGS84) */
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
  maxResults?: number;
}

export async function getNearbyAircraft(
  options: NearbyAircraftOptions,
  opts?: { skipCache?: boolean }
): Promise<{ aircraft: NearbyAircraft[]; error?: string }> {
  const bbox = `${options.lamin},${options.lomin},${options.lamax},${options.lomax}`;
  const cacheKey = cacheKeys.nearby(bbox);

  if (!opts?.skipCache) {
    const cached = getFromCache<OpenSkyAircraftNormalized[]>(cacheKey);
    if (cached) return { aircraft: cached };
  }

  try {
    const aircraft = await getOpenSkyNearbyAircraft({
      ...options,
      maxResults: options.maxResults ?? 50,
    });
    setInCache(cacheKey, aircraft);
    return { aircraft };
  } catch (err) {
    return {
      aircraft: [],
      error: err instanceof Error ? err.message : "Erro ao buscar aeronaves",
    };
  }
}
