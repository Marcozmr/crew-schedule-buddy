/**
 * Tipos do pipeline de enriquecimento — providers retornam parciais;
 * o merge produz um FlightRaw coeso antes de normalizeFlightData.
 */

import type { FlightRaw, EnrichmentFallbackReason } from "./types";

/** Dados extraídos exclusivamente da escala importada (schedule_entries → cliente). */
export interface FlightScaleData {
  id: string;
  flightNumber: string;
  carrierCode: string;
  origin: string;
  destination: string;
  departureScheduledISO: string | null;
  arrivalScheduledISO: string | null;
  aircraftCode: string | null;
}

/** Tracking OpenSky (posição ao vivo) — nunca lançar exceção nos providers. */
export interface FlightTrackingData {
  trackingAvailable: boolean;
  trackingStatus: "matched" | "no_match" | "unavailable";
  aircraftIcao: string | null;
  onGround: boolean | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  velocity: number | null;
  heading: number | null;
  lastContact: number | null;
  callsignMatched: string | null;
}

/** Metadados estáticos (DB / cadastro). */
export interface FlightAirportStaticInfo {
  iata: string;
  icao?: string | null;
  airportName: string | null;
  city: string | null;
  country: string | null;
  timezone: string | null;
}

/** Dados operacionais (FIDS futuro / gate dinâmico). */
export interface FlightAirportOperationalInfo {
  departure?: { gate: string | null; terminal: string | null };
  arrival?: { gate: string | null; terminal: string | null };
}

export interface FlightAirportData {
  departure?: FlightAirportStaticInfo | null;
  arrival?: FlightAirportStaticInfo | null;
  operational?: FlightAirportOperationalInfo | null;
}

/** Lista “todos os voos da base” vinda do edge (OpenSky airport flights). */
export interface FlightBaseAirportData {
  airportIata: string;
  dateIso: string;
  rawFlights: FlightRaw[];
  reasonIfEmpty?: string;
}

/**
 * Parcial aplicável sobre um FlightRaw — nunca mutar FlightNormalized diretamente.
 */
export interface FlightEnrichmentPartial {
  source: "scale" | "opensky" | "airport" | "base_airport" | "merge";
  tracking?: FlightRaw["tracking"] | null;
  trackingMeta?: {
    status: FlightTrackingData["trackingStatus"];
    aircraftIcao: string | null;
  };
  airportStatic?: {
    departure?: FlightAirportStaticInfo | null;
    arrival?: FlightAirportStaticInfo | null;
  };
  airportOperational?: FlightAirportOperationalInfo | null;
  /** Substitui apenas campos de tempo/status quando definidos */
  delayMinutes?: number | null;
  status?: string | null;
  icao24?: string | null;
  callsign?: string | null;
}

export type { EnrichmentFallbackReason } from "./types";
