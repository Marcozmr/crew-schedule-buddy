/**
 * Contrato da Edge Function `flight-search` (busca livre Pro Board).
 */

export type FlightSearchMode = "flight" | "airport";
export type FlightSearchDirection = "departure" | "arrival";

export interface FlightSearchRequest {
  mode: FlightSearchMode;
  direction: FlightSearchDirection;
  airport?: string;
  date: string;
  airline?: string;
  flightNumber?: string;
}

export interface FlightSearchResultItem {
  flightIdent: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  scheduledDeparture: string | null;
  estimatedDeparture: string | null;
  actualDeparture: string | null;
  scheduledArrival: string | null;
  estimatedArrival: string | null;
  actualArrival: string | null;
  status: string;
  statusLabel: string;
  aircraft: string | null;
  callsign: string | null;
  icao24?: string | null;
  tracking?: Record<string, unknown> | null;
}

export interface FlightSearchRateInfo {
  limit: number;
  count: number;
  remaining: number;
}

export interface FlightSearchResponseOk {
  ok: true;
  status: "ok";
  source: string;
  cached: boolean;
  quotaConsumed?: boolean;
  hint?: string;
  rate?: FlightSearchRateInfo;
  data: FlightSearchResultItem[];
}

export interface FlightSearchResponseErr {
  ok: false;
  status: "error";
  error: string;
  message?: string;
  rate?: FlightSearchRateInfo;
}

export type FlightSearchResponse = FlightSearchResponseOk | FlightSearchResponseErr;
