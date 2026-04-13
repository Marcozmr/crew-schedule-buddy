/**
 * Tipos do EscalaX Flight Board Pro
 * Pipeline de escala importada + enriquecimento e busca livre.
 */

import type { FlightOperationalStatus } from "./operationalStatus";
import type { OperationalCodeId } from "@/lib/roster/flight-role-labels";

/** Situação + função em linguagem simples (escala importada). */
export interface CrewSituationDisplay {
  tripStatusLabel: string;
  tripStatusVariant: "tripulando" | "extra_remunerado";
  roleLabel: string;
  minimizeRole: boolean;
  /** Siglas oficiais do roster/PDF — preferidas na UI compacta */
  tripStatusSigla?: string;
  roleSigla?: string;
}

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
  /** Hora de apresentação ISO (report_time) — usada no card mobile */
  presentationTimeISO?: string | null;
  /** Siglas operacionais (fontes que não preenchem crewSituation) */
  operationalCodes?: OperationalCodeId[];
  /** Exibição amigável — prioridade sobre operationalCodes na UI */
  crewSituation?: CrewSituationDisplay;
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
  /** Chips de origem (escala, OpenSky, aeroporto, minha base) */
  dataSources?: FlightDataSourceFlags;
  /** Match OpenSky explícito para UI */
  openSkyMatch?: "matched" | "no_match" | "unavailable" | "not_attempted";
  /** Motivo de fallback quando não há enriquecimento completo */
  enrichmentFallback?: EnrichmentFallbackReason;
  /** Label legível do fallback (PT) */
  enrichmentFallbackLabel?: string;
  /** Siglas operacionais (fallback) */
  operationalCodes?: OperationalCodeId[];
  crewSituation?: CrewSituationDisplay;
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
  /** IATA 3 letras ou `FLIGHT_BOARD_ALL_AIRPORTS` (todos os aeroportos no filtro). */
  airportCode: string;
  airlineCode: string;
  flightNumber: string;
  date: string;
  mode: "departures" | "arrivals";
  /**
   * Minha escala: trechos da escala importada com enriquecimento opcional.
   * Busca livre: pesquisa por aeroporto ou por voo, independente da escala.
   */
  boardMode: "my_schedule" | "free_search";
  /**
   * Apenas em `free_search`: busca por aeroporto (janela OpenSky) ou por identificação do voo.
   */
  freeSearchMode?: "airport" | "flight";
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
  /** `my_schedule`: merge com escala; `airport_base`: usado por integrações que consultam só o aeroporto. */
  boardMode?: "my_schedule" | "airport_base";
}

export interface FlightProvider {
  getFlights(options: FlightProviderOptions): Promise<FlightRaw[]>;
}
