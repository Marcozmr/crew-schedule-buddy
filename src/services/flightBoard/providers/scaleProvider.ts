/**
 * Escala importada → FlightRaw (fonte primária local).
 */

import type { ScheduleEntry } from "@/hooks/useScheduleData";
import type { FlightRaw } from "../types";
import {
  getOperationalEntriesForDate,
  scheduleEntryToFlightRaw,
  validateFlightDataRelaxed,
} from "../flightBoardOperational";

export function scaleEntriesToFlightRaws(
  entries: ScheduleEntry[],
  airportCode: string,
  dateIso: string
): FlightRaw[] {
  const day = getOperationalEntriesForDate(entries, dateIso).filter((e) => e.is_flight);
  const upper = airportCode.toUpperCase();
  const out: FlightRaw[] = [];
  const seen = new Set<string>();
  for (const entry of day) {
    const raw = { ...scheduleEntryToFlightRaw(entry), recordSource: "schedule_edge" as const };
    if (!validateFlightDataRelaxed(raw, upper).valid) continue;
    if (seen.has(raw.id)) continue;
    seen.add(raw.id);
    out.push(raw);
  }
  return out;
}

export function extractScaleDataFromRaw(raw: FlightRaw): import("../flightEnrichmentTypes").FlightScaleData {
  return {
    id: raw.id,
    flightNumber: raw.flightNumber,
    carrierCode: raw.carrierCode,
    origin: raw.origin,
    destination: raw.destination,
    departureScheduledISO: raw.departure.scheduledISO ?? null,
    arrivalScheduledISO: raw.arrival.scheduledISO ?? null,
    aircraftCode: raw.aircraftCode,
  };
}
