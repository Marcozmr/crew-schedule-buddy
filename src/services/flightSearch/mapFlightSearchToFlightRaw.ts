/**
 * Converte o DTO da busca livre para `FlightRaw` (pipeline existente do Flight Board).
 */

import type { FlightRaw } from "@/services/flightBoard/types";
import type { FlightSearchResultItem } from "./flightSearchTypes";

function hhmmFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function mapFlightSearchItemToFlightRaw(item: FlightSearchResultItem): FlightRaw {
  const id = item.flightIdent.replace(/[^a-zA-Z0-9_-]/g, "_");
  const tracking = item.tracking
    ? {
        latitude: item.tracking.latitude as number | null | undefined,
        longitude: item.tracking.longitude as number | null | undefined,
        altitude: item.tracking.altitude as number | null | undefined,
        velocity: item.tracking.velocity as number | null | undefined,
        heading: item.tracking.heading as number | null | undefined,
        onGround: item.tracking.onGround as boolean | null | undefined,
        callsign: (item.tracking.callsign as string | null | undefined) ?? item.callsign,
        icao24: (item.tracking.icao24 as string | null | undefined) ?? item.icao24 ?? null,
        lastContact: item.tracking.lastContact as number | null | undefined,
      }
    : null;

  return {
    id,
    flightNumber: `${item.airline}${item.flightNumber}`.replace(/\s+/g, ""),
    carrierCode: item.airline,
    origin: item.origin,
    destination: item.destination,
    departure: {
      scheduled: hhmmFromIso(item.scheduledDeparture),
      actual: hhmmFromIso(item.actualDeparture ?? item.estimatedDeparture),
      terminal: null,
      gate: null,
      scheduledISO: item.scheduledDeparture,
      actualISO: item.actualDeparture ?? null,
    },
    arrival: {
      scheduled: hhmmFromIso(item.scheduledArrival),
      actual: hhmmFromIso(item.actualArrival ?? item.estimatedArrival),
      terminal: null,
      gate: null,
      scheduledISO: item.scheduledArrival,
      actualISO: item.actualArrival ?? null,
    },
    aircraftCode: item.aircraft,
    callsign: item.callsign,
    icao24: item.icao24 ?? null,
    delayMinutes: null,
    tracking,
    airportInfo: null,
    status: item.status.toUpperCase(),
    recordSource: "opensky_airport_base",
  };
}
