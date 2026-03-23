/**
 * OpenSky — extrai parcial de tracking a partir de FlightRaw já mesclado pela edge.
 * Nunca lança; trackingStatus = no_match quando não há posição.
 */

import type { FlightRaw } from "../types";
import type { FlightEnrichmentPartial, FlightTrackingData } from "../flightEnrichmentTypes";

/** Normaliza callsign / número: LA3359, LA 3359, LA-3359 → LA3359 */
export function normalizeFlightCallsign(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/[\s\-_/]+/g, "")
    .toUpperCase();
}

export function buildOpenSkyPartialFromRaw(raw: FlightRaw): FlightEnrichmentPartial {
  const t = raw.tracking;
  const hasLatLon =
    t != null &&
    typeof t.latitude === "number" &&
    typeof t.longitude === "number" &&
    !Number.isNaN(t.latitude) &&
    !Number.isNaN(t.longitude);

  const trackingData: FlightTrackingData = {
    trackingAvailable: hasLatLon,
    trackingStatus: hasLatLon ? "matched" : t === null ? "no_match" : "unavailable",
    aircraftIcao: raw.icao24 ?? t?.icao24 ?? null,
    onGround: t?.onGround ?? null,
    latitude: t?.latitude ?? null,
    longitude: t?.longitude ?? null,
    altitude: t?.altitude ?? null,
    velocity: t?.velocity ?? null,
    heading: t?.heading ?? null,
    lastContact: t?.lastContact ?? null,
    callsignMatched: t?.callsign ?? null,
  };

  return {
    source: "opensky",
    tracking: t ?? null,
    trackingMeta: {
      status: trackingData.trackingStatus,
      aircraftIcao: trackingData.aircraftIcao,
    },
  };
}
