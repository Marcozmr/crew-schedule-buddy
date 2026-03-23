/**
 * mergeFlightData — regras: escala (número, rota, grade) + enrichment (tracking, status, aeroporto).
 * Sempre retorna um novo FlightRaw (imutável).
 */

import type { FlightRaw } from "../types";
import type { FlightEnrichmentPartial } from "../flightEnrichmentTypes";

function mergeFlightRaw(
  base: FlightRaw,
  openSky: FlightEnrichmentPartial | null,
  airport: FlightEnrichmentPartial | null
): FlightRaw {
  let next: FlightRaw = { ...base };

  if (airport?.airportStatic) {
    next = {
      ...next,
      airportInfo: {
        departure: airport.airportStatic.departure
          ? {
              name: airport.airportStatic.departure.airportName,
              city: airport.airportStatic.departure.city,
              country: airport.airportStatic.departure.country,
              timezone: airport.airportStatic.departure.timezone,
              iata: airport.airportStatic.departure.iata,
              icao: airport.airportStatic.departure.icao,
            }
          : next.airportInfo?.departure,
        arrival: airport.airportStatic.arrival
          ? {
              name: airport.airportStatic.arrival.airportName,
              city: airport.airportStatic.arrival.city,
              country: airport.airportStatic.arrival.country,
              timezone: airport.airportStatic.arrival.timezone,
              iata: airport.airportStatic.arrival.iata,
              icao: airport.airportStatic.arrival.icao,
            }
          : next.airportInfo?.arrival,
      },
    };
  }

  if (airport?.airportOperational) {
    const op = airport.airportOperational;
    next = {
      ...next,
      departure: {
        ...next.departure,
        gate: op.departure?.gate ?? next.departure.gate,
        terminal: op.departure?.terminal ?? next.departure.terminal,
      },
      arrival: {
        ...next.arrival,
        gate: op.arrival?.gate ?? next.arrival.gate,
        terminal: op.arrival?.terminal ?? next.arrival.terminal,
      },
    };
  }

  if (openSky?.tracking !== undefined) {
    next = {
      ...next,
      tracking: openSky.tracking ?? null,
      icao24: openSky.icao24 ?? next.icao24,
      callsign: openSky.callsign ?? next.callsign,
    };
  }

  if (openSky?.trackingMeta?.aircraftIcao) {
    next = { ...next, icao24: openSky.trackingMeta.aircraftIcao };
  }

  if (airport?.delayMinutes != null) {
    next = { ...next, delayMinutes: airport.delayMinutes };
  }
  if (airport?.status != null) {
    next = { ...next, status: airport.status };
  }
  if (openSky && "delayMinutes" in openSky && openSky.delayMinutes != null) {
    next = { ...next, delayMinutes: openSky.delayMinutes };
  }
  if (openSky && "status" in openSky && openSky.status != null) {
    next = { ...next, status: openSky.status };
  }

  return next;
}

/**
 * Mescla parciais sobre uma linha base (escala ou servidor).
 * Ordem: airport primeiro (contexto), depois OpenSky (tracking sobrescreve).
 */
export function mergeFlightData(
  base: FlightRaw,
  partials: { openSky?: FlightEnrichmentPartial | null; airport?: FlightEnrichmentPartial | null }
): FlightRaw {
  return mergeFlightRaw(base, partials.openSky ?? null, partials.airport ?? null);
}

export function mergeFlightListWithPartials(
  bases: FlightRaw[],
  enrichmentById: Map<string, FlightRaw>,
  getPartials: (merged: FlightRaw) => {
    openSky: FlightEnrichmentPartial;
    airport: FlightEnrichmentPartial;
  }
): FlightRaw[] {
  return bases.map((b) => {
    const ex = enrichmentById.get(b.id);
    const mergedBase = ex ? { ...b, ...ex, id: b.id } : b;
    const { openSky, airport } = getPartials(mergedBase);
    return mergeFlightData(mergedBase, { openSky, airport });
  });
}
