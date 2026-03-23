/**
 * Tipos do EscalaX Flight Board Pro
 * Preparados para pipeline de escala + enriquecimento local + OpenSky
 */

import type { FlightOperationalStatus } from "./operationalStatus";

export type EnrichmentFallbackReason =
  | "NO_LIVE_DATA"
  | "NO_MATCH"
  | "NO_ENRICHMENT"
  | "SCALE_ONLY"
  | "AIRPORT_ONLY"
  | "NONE";

export type FlightStatusKey =
  | "on_time"
  | "boarding"
  | "next"
  | "delayed"
  | "cancelled"
  | "completed"
  | "unknown";

/** Origem agregada do registro (edge / escala). */
export type FlightRecordSource =
  | "schedule_edge"
  | "opensky_airport_base"
  | "mock";

export interface FlightRaw {
  id: string;
  flightNumber: string;
  carrierCode: string;
  origin: string;
  destination: string;
  departure: {
    scheduled: string | null;
    actual: string | null;
    terminal: string | null;
    gate: string | null;
    /** ISO string para cálculo preciso (UTC) */
    scheduledISO?: string | null;
    actualISO?: string | null;
  };
  arrival: {
    scheduled: string | null;
    actual: string | null;
    terminal: string | null;
    gate: string | null;
    scheduledISO?: string | null;
    actualISO?: string | null;
  };
  aircraftCode: string | null;
  callsign?: string | null;
  icao24?: string | null;
  status: string;
  /** Atraso em minutos (estimated - scheduled ou actual - scheduled) */
  delayMinutes?: number | null;
  tracking?: {
    latitude?: number | null;
    longitude?: number | null;
    altitude?: number | null;
    velocity?: number | null;
    heading?: number | null;
    onGround?: boolean | null;
    callsign?: string | null;
    icao24?: string | null;
    lastContact?: number | null;
  } | null;
  airportInfo?: {
    departure?: {
      name?: string | null;
      city?: string | null;
      country?: string | null;
      timezone?: string | null;
      iata?: string | null;
      icao?: string | null;
    } | null;
    arrival?: {
      name?: string | null;
      city?: string | null;
      country?: string | null;
      timezone?: string | null;
      iata?: string | null;
      icao?: string | null;
    } | null;
  } | null;
  /** Metadado opcional da edge */
  recordSource?: FlightRecordSource;
}

export interface FlightDataSourceFlags {
  scale: boolean;
  openSky: boolean;
  airport: boolean;
  baseAirport: boolean;
}

export interface FlightNormalized {
  id: string;
  flightNumber: string;
  airlineName: string;
  carrierCode: string;
  origin: string;
  destination: string;
  scheduledTime: string;
  estimatedTime: string | null;
  statusKey: FlightStatusKey;
  statusLabel: string;
  delayMinutes: number | null;
  aircraft: string | null;
  gate: string | null;
  terminal: string | null;
  tracking?: FlightRaw["tracking"];
  airportInfo?: FlightRaw["airportInfo"];
  /** Timestamp em ms para ordenação e cálculo de tempo restante */
  scheduledTimestamp: number;
  estimatedTimestamp: number | null;
  /** Origem do agregador: escala importada vs enriquecida com dados ao vivo */
  aggregateSource?: "roster" | "roster_enriched";
  /** Indica se há tracking/posição ao vivo disponível para o trecho */
  liveTrackingAvailable?: boolean;
  /** Status operacional agregado (tracking + horário + atraso) */
  operationalStatus?: FlightOperationalStatus;
  /** Chips de origem (escala, OpenSky, aeroporto, base) */
  dataSources?: FlightDataSourceFlags;
  /** Match OpenSky explícito para UI */
  openSkyMatch?: "matched" | "no_match" | "unavailable" | "not_attempted";
  /** Motivo de fallback quando não há enriquecimento completo */
  enrichmentFallback?: EnrichmentFallbackReason;
  /** Label legível do fallback (PT) */
  enrichmentFallbackLabel?: string;
}

export type FlightBoardData = {
  flightNumber: string;
  airline?: string | null;
  departureAirport?: string | null;
  arrivalAirport?: string | null;
  scheduledDeparture?: string | null;
  estimatedDeparture?: string | null;
  scheduledArrival?: string | null;
  estimatedArrival?: string | null;
  presentationTime?: string | null;
  terminal?: string | null;
  gate?: string | null;
  delayMinutes?: number | null;
  status?: string | null;
  aircraft?: string | null;
  airportInfo?: FlightRaw["airportInfo"];
  tracking?: FlightRaw["tracking"] | null;
};

export interface FlightFilters {
  airportCode: string;
  airlineCode: string;
  flightNumber: string;
  date: string;
  mode: "departures" | "arrivals";
  /**
   * Minha escala: lista alinhada à escala local + merge com edge.
   * Base operacional: lista montada a partir do payload da edge (mesmos voos da escala no servidor, prioriza status/aeroporto do servidor).
   */
  boardMode: "my_schedule" | "airport_base";
}

export interface FlightBoardResult {
  departures: FlightNormalized[];
  arrivals: FlightNormalized[];
  lastUpdatedAt: string;
  error?: string;
}

export interface FlightProviderOptions {
  airportCode: string;
  date: string;
  airlineCode?: string;
  flightNumber?: string;
  /** default my_schedule — airport_base ativa OpenSky flights no edge */
  boardMode?: "my_schedule" | "airport_base";
}

export interface FlightProvider {
  getFlights(options: FlightProviderOptions): Promise<FlightRaw[]>;
}
