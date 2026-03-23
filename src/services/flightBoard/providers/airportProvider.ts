/**
 * Contexto aeroportuário — separa estático (nome/cidade/fuso) de operacional (gate/terminal).
 */

import type { FlightRaw } from "../types";
import type {
  FlightAirportData,
  FlightAirportOperationalInfo,
  FlightAirportStaticInfo,
  FlightEnrichmentPartial,
} from "../flightEnrichmentTypes";

function sideToStatic(
  side: NonNullable<FlightRaw["airportInfo"]>["departure"],
  iataFallback: string
): FlightAirportStaticInfo {
  return {
    iata: side?.iata ?? iataFallback,
    icao: side?.icao ?? null,
    airportName: side?.name ?? null,
    city: side?.city ?? null,
    country: side?.country ?? null,
    timezone: side?.timezone ?? null,
  };
}

export function buildAirportDataFromRaw(
  raw: FlightRaw,
  originIata: string,
  destIata: string
): FlightAirportData {
  const dep = raw.airportInfo?.departure;
  const arr = raw.airportInfo?.arrival;
  const operational: FlightAirportOperationalInfo = {
    departure: {
      gate: raw.departure.gate,
      terminal: raw.departure.terminal,
    },
    arrival: {
      gate: raw.arrival.gate,
      terminal: raw.arrival.terminal,
    },
  };

  return {
    departure: dep ? sideToStatic(dep, originIata) : null,
    arrival: arr ? sideToStatic(arr, destIata) : null,
    operational,
  };
}

export function buildAirportPartialFromRaw(raw: FlightRaw): FlightEnrichmentPartial {
  const dep = raw.airportInfo?.departure;
  const arr = raw.airportInfo?.arrival;
  return {
    source: "airport",
    airportStatic: {
      departure: dep
        ? {
            iata: dep.iata ?? null,
            icao: dep.icao ?? null,
            airportName: dep.name ?? null,
            city: dep.city ?? null,
            country: dep.country ?? null,
            timezone: dep.timezone ?? null,
          }
        : null,
      arrival: arr
        ? {
            iata: arr.iata ?? null,
            icao: arr.icao ?? null,
            airportName: arr.name ?? null,
            city: arr.city ?? null,
            country: arr.country ?? null,
            timezone: arr.timezone ?? null,
          }
        : null,
    },
    airportOperational: {
      departure: { gate: raw.departure.gate, terminal: raw.departure.terminal },
      arrival: { gate: raw.arrival.gate, terminal: raw.arrival.terminal },
    },
  };
}
