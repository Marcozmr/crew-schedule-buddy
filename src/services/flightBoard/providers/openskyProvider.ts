/**
 * Provedor OpenSky Network para tracking de aeronaves
 * Documentação: https://openskynetwork.github.io/opensky-api/
 */

import { flightApiConfig } from "../apiConfig";

export interface OpenSkyAircraftNormalized {
  callsign: string;
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  heading: number;
  icao24?: string;
  onGround?: boolean;
}

const TIMEOUT_MS = flightApiConfig.opensky.timeoutMs;
const BASE = flightApiConfig.opensky.baseUrl;

/**
 * OpenSky states array indices:
 * 0: icao24, 1: callsign, 2: origin_country, 3: time_position, 4: last_contact,
 * 5: longitude, 6: latitude, 7: baro_altitude, 8: on_ground, 9: velocity,
 * 10: true_track, 11: vertical_rate, ...
 */
function parseStateVector(row: unknown[]): OpenSkyAircraftNormalized | null {
  if (!Array.isArray(row) || row.length < 11) return null;

  const latitude = Number(row[6]);
  const longitude = Number(row[5]);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;

  const callsign = (row[1] ?? "").toString().trim() || "—";
  const baroAlt = row[7];
  const velocityMs = row[9];
  const trueTrack = row[10];

  return {
    callsign,
    latitude,
    longitude,
    altitude: typeof baroAlt === "number" && !Number.isNaN(baroAlt) ? Math.round(baroAlt) : 0,
    velocity: typeof velocityMs === "number" && !Number.isNaN(velocityMs)
      ? Math.round(velocityMs * 3.6) // m/s -> km/h
      : 0,
    heading: typeof trueTrack === "number" && !Number.isNaN(trueTrack) ? Math.round(trueTrack) : 0,
    icao24: typeof row[0] === "string" ? row[0] : undefined,
    onGround: row[8] === true,
  };
}

async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export interface NearbyAircraftOptions {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
  maxResults?: number;
}

export async function getOpenSkyNearbyAircraft(
  options: NearbyAircraftOptions
): Promise<OpenSkyAircraftNormalized[]> {
  const params = new URLSearchParams();
  params.set("lamin", String(options.lamin));
  params.set("lomin", String(options.lomin));
  params.set("lamax", String(options.lamax));
  params.set("lomax", String(options.lomax));

  const url = `${BASE}/states/all?${params.toString()}`;
  const response = await fetchWithTimeout(url, {}, TIMEOUT_MS);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message ?? "Erro na API OpenSky");
  }

  const states: unknown[] = Array.isArray(data?.states) ? data.states : [];
  const maxResults = options.maxResults ?? 50;

  return states
    .map((row) => parseStateVector(row as unknown[]))
    .filter((a): a is OpenSkyAircraftNormalized => a != null)
    .filter((a) => !a.onGround && (a.altitude > 0 || a.velocity > 0))
    .slice(0, maxResults);
}
