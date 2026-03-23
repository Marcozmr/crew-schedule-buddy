/**
 * Tipos do EscalaX Flight Board Pro
 * Preparados para pipeline de escala + enriquecimento local + OpenSky
 */

export type FlightStatusKey =
  | "on_time"
  | "boarding"
  | "next"
  | "delayed"
  | "cancelled"
  | "completed"
  | "unknown";

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
    } | null;
    arrival?: {
      name?: string | null;
      city?: string | null;
      country?: string | null;
      timezone?: string | null;
    } | null;
  } | null;
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
}

export interface FlightProvider {
  getFlights(options: FlightProviderOptions): Promise<FlightRaw[]>;
}
