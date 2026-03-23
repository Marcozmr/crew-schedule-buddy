/**
 * Base operacional — voos gerais do aeroporto (payload da edge com recordSource opensky_airport_base).
 */

import type { FlightRaw } from "../types";
import type { FlightBaseAirportData, FlightEnrichmentPartial } from "../flightEnrichmentTypes";

export function filterBaseAirportFlights(
  flights: FlightRaw[],
  airportIata: string,
  carrierCode?: string,
  flightNumber?: string
): FlightRaw[] {
  const upper = airportIata.toUpperCase();
  let list = flights.filter(
    (f) => f.recordSource === "opensky_airport_base" || f.origin === upper || f.destination === upper
  );
  if (carrierCode?.trim()) {
    const c = carrierCode.trim().toUpperCase();
    list = list.filter((f) => f.carrierCode.toUpperCase().startsWith(c));
  }
  if (flightNumber?.trim()) {
    const q = flightNumber.trim().toUpperCase();
    list = list.filter((f) => f.flightNumber.toUpperCase().includes(q));
  }
  return list;
}

export function wrapBaseAirportPayload(
  airportIata: string,
  dateIso: string,
  rawFlights: FlightRaw[],
  reasonIfEmpty?: string
): FlightBaseAirportData {
  return {
    airportIata: airportIata.toUpperCase(),
    dateIso,
    rawFlights,
    reasonIfEmpty,
  };
}

export function buildBaseAirportPartial(_data: FlightBaseAirportData): FlightEnrichmentPartial {
  return {
    source: "base_airport",
  };
}
