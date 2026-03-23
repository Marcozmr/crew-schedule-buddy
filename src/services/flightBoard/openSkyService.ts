import type { FlightRaw } from "./types";

export type AircraftTracking = NonNullable<FlightRaw["tracking"]>;

export function normalizeTrackingFromFlight(raw: FlightRaw): AircraftTracking | null {
  const t = raw.tracking;
  if (!t) return null;
  if (t.latitude == null || t.longitude == null) return null;
  return {
    latitude: t.latitude ?? null,
    longitude: t.longitude ?? null,
    altitude: t.altitude ?? null,
    velocity: t.velocity ?? null,
    heading: t.heading ?? null,
    onGround: t.onGround ?? null,
    callsign: t.callsign ?? raw.callsign ?? null,
    icao24: t.icao24 ?? raw.icao24 ?? null,
    lastContact: t.lastContact ?? null,
  };
}
