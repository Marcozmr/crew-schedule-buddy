/**
 * Serviço de voos EscalaX — Facade principal
 *
 * Integra:
 * - Escala do usuário (via Supabase): dados principais do voo
 * - OpenSky (via Supabase): tracking opcional ADS-B
 *
 * Chaves em .env (nunca hardcodar):
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 */

// Flight board
export {
  getFlightsByAirport,
  normalizeFlightData,
  invalidateFlightCache,
  getDepartures as filterDepartures,
  getArrivals as filterArrivals,
} from "./flightBoard/flightService";
export { getFlightBoardData as getUnifiedFlightBoardData } from "./flightBoard/flightBoardDataService";
export { getFlightStatus } from "./flightBoard/flightStatusService";
export { getNearbyAircraft } from "./flightBoard/nearbyAircraftService";

// Types
export type {
  FlightNormalized,
  FlightRaw,
  FlightFilters,
} from "./flightBoard/types";
export type { FlightStatusResult } from "./flightBoard/flightStatusService";
export type { NearbyAircraft, NearbyAircraftOptions } from "./flightBoard/nearbyAircraftService";

// Provider (para debug/troca de API)
export {
  createFlightProvider,
  getActiveProviderType,
} from "./flightBoard/flightProvider";

// Helpers de data/hora Brasil (UTC → pt-BR)
export {
  formatBrazilianDate,
  formatBrazilianTime,
  formatBrazilianDateTime,
  formatBrazilianTimeFromISO,
  formatFlightTimeRemaining,
  calculateDelayMinutes,
} from "./flightBoard/flightDateUtils";

/**
 * getFlights — alias amigável para getFlightsByAirport
 */
export { getFlightsByAirport as getFlights } from "./flightBoard/flightService";

/**
 * Helpers para buscar apenas partidas ou chegadas
 */
import { getFlightsByAirport } from "./flightBoard/flightService";
import {
  getDepartures as filterDepartures,
  getArrivals as filterArrivals,
} from "./flightBoard/flightService";
import type { FlightNormalized } from "./flightBoard/types";

export async function getDepartures(
  airportCode: string,
  date: string,
  filters?: { airlineCode?: string; flightNumber?: string }
): Promise<{ departures: FlightNormalized[]; error?: string }> {
  const result = await getFlightsByAirport(
    airportCode,
    date,
    filters?.airlineCode,
    filters?.flightNumber
  );
  const departures = filterDepartures(result.departures, filters ?? {});
  return { departures, error: result.error };
}

export async function getArrivals(
  airportCode: string,
  date: string,
  filters?: { airlineCode?: string; flightNumber?: string }
): Promise<{ arrivals: FlightNormalized[]; error?: string }> {
  const result = await getFlightsByAirport(
    airportCode,
    date,
    filters?.airlineCode,
    filters?.flightNumber
  );
  const arrivals = filterArrivals(result.arrivals, filters ?? {});
  return { arrivals, error: result.error };
}
