/**
 * Orquestração do pipeline + logs [FlightBoardPipeline] / [FlightBoardAirportMode].
 */

import type {
  FlightNormalized,
  EnrichmentFallbackReason,
  FlightRaw,
} from "./types";
import type { EnrichmentFetchMeta } from "./flightProvider";
import { resolveOperationalStatus } from "./operationalStatus";

export interface PipelineLogPayload {
  scaleFlights: number;
  openSkyMatches: number;
  airportEnriched: number;
  baseAirportFlights: number;
  finalFlights: number;
  fallbackReason: EnrichmentFallbackReason;
}

export function logFlightBoardPipeline(payload: PipelineLogPayload): void {
  console.log("[FlightBoardPipeline]", {
    scaleFlights: payload.scaleFlights,
    openSkyMatches: payload.openSkyMatches,
    airportEnriched: payload.airportEnriched,
    baseAirportFlights: payload.baseAirportFlights,
    finalFlights: payload.finalFlights,
    fallbackReason: payload.fallbackReason,
  });
}

export function logFlightBoardAirportMode(payload: {
  airportSelected: string;
  date: string;
  companyFilter: string;
  flightFilter: string;
  payloadSent: Record<string, string>;
  flightsReturned: number;
  flightsAfterFilter: number;
  reasonZeroResults: string | null;
}): void {
  console.log("[FlightBoardAirportMode]", payload);
}

function countAirportEnriched(raw: FlightRaw[]): number {
  return raw.filter((r) => r.airportInfo?.departure?.name || r.airportInfo?.arrival?.name).length;
}

function countOpenSkyMatches(raw: FlightRaw[]): number {
  return raw.filter(
    (r) =>
      r.tracking != null &&
      r.tracking.latitude != null &&
      r.tracking.longitude != null
  ).length;
}

export function computePipelineMetrics(args: {
  raw: FlightRaw[];
  finalDep: FlightNormalized[];
  finalArr: FlightNormalized[];
  scaleCount: number;
  boardMode: "my_schedule" | "airport_base";
  meta: EnrichmentFetchMeta;
}): PipelineLogPayload {
  const finalFlights = args.finalDep.length + args.finalArr.length;
  const openSkyMatches = countOpenSkyMatches(args.raw);
  const airportEnriched = countAirportEnriched(args.raw);

  let fallbackReason: EnrichmentFallbackReason = "NONE";
  if (args.meta.skipped || args.meta.reason !== "ok") {
    fallbackReason = "NO_ENRICHMENT";
  } else if (args.raw.length === 0) {
    fallbackReason = args.boardMode === "airport_base" ? "AIRPORT_ONLY" : "SCALE_ONLY";
  } else if (openSkyMatches === 0) {
    fallbackReason = "NO_MATCH";
  } else if (!args.raw.some((r) => r.tracking)) {
    fallbackReason = "NO_LIVE_DATA";
  }

  return {
    scaleFlights: args.scaleCount,
    openSkyMatches,
    airportEnriched,
    baseAirportFlights: args.boardMode === "airport_base" ? args.raw.length : 0,
    finalFlights,
    fallbackReason,
  };
}

/**
 * Enriquece voos normalizados com status operacional, flags de origem e fallback explícito.
 */
export function finalizeNormalizedFlights(
  list: FlightNormalized[],
  rawById: Map<string, FlightRaw>,
  opts: {
    boardMode: "my_schedule" | "airport_base";
    meta: EnrichmentFetchMeta;
  }
): FlightNormalized[] {
  const nowMs = Date.now();
  return list.map((f) => {
    const raw = rawById.get(f.id);

    const hasLive =
      f.tracking != null &&
      f.tracking.latitude != null &&
      f.tracking.longitude != null;
    const openSkyMatch = opts.meta.skipped
      ? "unavailable"
      : !raw
        ? "not_attempted"
        : hasLive
          ? "matched"
          : "no_match";

    let enrichmentFallback: EnrichmentFallbackReason = "NONE";
    let enrichmentFallbackLabel: string | undefined;

    if (opts.meta.skipped) {
      enrichmentFallback = "NO_ENRICHMENT";
      enrichmentFallbackLabel = "Enriquecimento indisponível (sessão ou config).";
    } else if (opts.meta.reason !== "ok") {
      enrichmentFallback = "NO_ENRICHMENT";
      enrichmentFallbackLabel = "Servidor de enriquecimento não retornou dados válidos.";
    } else if (!hasLive && raw) {
      enrichmentFallback = "NO_MATCH";
      enrichmentFallbackLabel = "OpenSky sem posição ao vivo para este voo.";
    }

    const depMs = raw?.departure?.scheduledISO
      ? new Date(raw.departure.scheduledISO).getTime()
      : f.scheduledTimestamp;
    const arrMs = raw?.arrival?.scheduledISO
      ? new Date(raw.arrival.scheduledISO).getTime()
      : f.estimatedTimestamp ?? depMs + 2 * 60 * 60 * 1000;

    const operationalStatus = resolveOperationalStatus({
      tracking: f.tracking,
      delayMinutes: f.delayMinutes,
      rawStatus: raw?.status,
      nowMs,
      scheduledDepMs: depMs,
      scheduledArrMs: arrMs,
    });

    const dataSources = {
      scale: opts.boardMode === "my_schedule",
      openSky: hasLive,
      airport: Boolean(
        raw?.airportInfo?.departure?.city || raw?.airportInfo?.arrival?.city
      ),
      baseAirport: opts.boardMode === "airport_base",
    };

    return {
      ...f,
      operationalStatus,
      dataSources,
      openSkyMatch,
      enrichmentFallback,
      enrichmentFallbackLabel,
    };
  });
}
