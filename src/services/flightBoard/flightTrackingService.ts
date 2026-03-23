import type { FlightRaw } from "./types";
import { normalizeTrackingFromFlight } from "./openSkyService";

/**
 * Tracking opcional: nunca quebra o Flight Board.
 * Dados principais continuam vindo da escala do usuário.
 */
export function getAircraftTracking(raw: FlightRaw): FlightRaw["tracking"] | null {
  try {
    return normalizeTrackingFromFlight(raw);
  } catch (err) {
    console.warn("[FlightTracking] tracking unavailable:", err instanceof Error ? err.message : String(err));
    return null;
  }
}
