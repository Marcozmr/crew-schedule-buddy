/**
 * Logs temporários do pipeline de enriquecimento (edge flight-status + OpenSky + aeroportos).
 * Remover ou reduzir verbosidade após estabilização.
 */

import type { FlightRaw } from "./types";

export type EnrichmentPipelineStage =
  | "roster_extracted"
  | "fetch_attempt"
  | "fetch_response"
  | "fetch_result"
  | "fetch_fallback"
  | "merge_roster"
  | "merge_base_mode"
  | "banner_reason";

export function logEnrichmentPipeline(
  stage: EnrichmentPipelineStage,
  payload: Record<string, unknown>
): void {
  console.log(`[FlightBoardPro] pipeline:${stage}`, {
    ts: new Date().toISOString(),
    ...payload,
  });
}

export function summarizeEnrichmentRaw(raw: FlightRaw[]): {
  count: number;
  ids: string[];
  withAirportInfo: number;
  withTrackingLatLon: number;
  statuses: string[];
} {
  return {
    count: raw.length,
    ids: raw.slice(0, 12).map((r) => r.id),
    withAirportInfo: raw.filter((r) => r.airportInfo?.departure || r.airportInfo?.arrival).length,
    withTrackingLatLon: raw.filter(
      (r) => r.tracking != null && r.tracking.latitude != null && r.tracking.longitude != null
    ).length,
    statuses: [...new Set(raw.map((r) => String(r.status ?? "")))].slice(0, 8),
  };
}
