/**
 * Serviço principal do EscalaX Flight Board Pro
 * Consistência operacional > quantidade
 * Cache 5 min. Sem mistura mock/real.
 */

import type { FlightRaw, FlightNormalized } from "./types";
import { CARRIER_NAMES, MAX_FLIGHTS_PER_LIST } from "./constants";
import { createFlightProvider } from "./flightProvider";
import {
  getFromCache,
  setInCache,
  invalidateCache,
  cacheKeys,
} from "./flightCache";
import { validateFlightData } from "./flightValidation";
import { normalizeStatusToKey, getStatusLabel } from "./statusUtils";
import {
  scheduledToTimestamp,
  calculateDelayMinutes,
} from "./flightDateUtils";
import { getAircraftTracking } from "./flightTrackingService";

export function normalizeFlightData(
  raw: FlightRaw,
  dateStr: string,
  mode: "departure" | "arrival",
  airportCode: string
): FlightNormalized | null {
  const dep = raw.departure;
  const arr = raw.arrival;

  const scheduledTime = mode === "departure" ? dep.scheduled : arr.scheduled;
  const estimatedTime = mode === "departure" ? dep.actual : arr.actual;
  const gate = mode === "departure" ? dep.gate : arr.gate;
  const terminal = mode === "departure" ? dep.terminal : arr.terminal;
  const scheduledISO = mode === "departure" ? dep.scheduledISO : arr.scheduledISO;
  const estimatedISO = mode === "departure" ? dep.actualISO : arr.actualISO;

  let delayMinutes: number | null = null;
  if (raw.delayMinutes != null && raw.delayMinutes >= 0) {
    delayMinutes = raw.delayMinutes;
  } else if (scheduledISO && estimatedISO) {
    const computed = calculateDelayMinutes(scheduledISO, estimatedISO);
    if (computed != null && computed >= 0) delayMinutes = computed;
  }
  if (delayMinutes != null && delayMinutes < 0) delayMinutes = null;

  const statusKey = normalizeStatusToKey(raw.status, delayMinutes);
  const statusLabel = getStatusLabel(statusKey);

  const scheduledTimestamp = scheduledISO
    ? new Date(scheduledISO).getTime()
    : scheduledToTimestamp(dateStr, scheduledTime ?? "");
  const estimatedTimestamp = estimatedISO
    ? new Date(estimatedISO).getTime()
    : estimatedTime
      ? scheduledToTimestamp(dateStr, estimatedTime)
      : null;

  const presentationTime =
    mode === "departure" && (raw as { presentationTimeISO?: string | null }).presentationTimeISO
      ? (() => {
          const iso = (raw as { presentationTimeISO?: string | null }).presentationTimeISO;
          if (!iso) return null;
          const m = String(iso).match(/T(\d{1,2}):(\d{2})/);
          return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
        })()
      : null;

  return {
    id: raw.id,
    flightNumber: raw.flightNumber,
    airlineName: CARRIER_NAMES[raw.carrierCode] ?? raw.carrierCode,
    carrierCode: raw.carrierCode,
    origin: raw.origin,
    destination: raw.destination,
    scheduledTime: scheduledTime ?? "—",
    estimatedTime: estimatedTime ?? null,
    statusKey,
    statusLabel,
    delayMinutes,
    aircraft: raw.aircraftCode ?? null,
    gate,
    terminal,
    tracking: getAircraftTracking(raw),
    airportInfo: raw.airportInfo ?? null,
    scheduledTimestamp,
    estimatedTimestamp,
    presentationTime,
    operationalCodes: raw.operationalCodes,
    crewSituation: raw.crewSituation,
  };
}

const API_UNAVAILABLE_MSG = "Dados de voo indisponíveis no momento. Tente novamente em alguns instantes.";
const API_ERROR_MSG = "API temporariamente indisponível. Verifique sua conexão e tente novamente.";

export interface GetFlightsResult {
  departures: FlightNormalized[];
  arrivals: FlightNormalized[];
  error?: string;
  /** Mensagem técnica para exibir em dev (import.meta.env.DEV) */
  technicalError?: string;
}

export async function getFlightsByAirport(
  airportCode: string,
  date: string,
  airlineCode?: string,
  flightNumber?: string,
  options?: { skipCache?: boolean }
): Promise<GetFlightsResult> {
  const cacheKey = cacheKeys.flights(
    airportCode,
    date,
    `${airlineCode ?? ""}-${flightNumber ?? ""}`
  );

  if (!options?.skipCache) {
    const cached = getFromCache<{
      departures: FlightNormalized[];
      arrivals: FlightNormalized[];
    }>(cacheKey);
    if (cached) return cached;
  }

  const provider = createFlightProvider();

  try {
    const rawList = await provider.getFlights({
      airportCode,
      date,
      airlineCode,
      flightNumber,
    });

    const departures: FlightNormalized[] = [];
    const arrivals: FlightNormalized[] = [];

    for (const raw of rawList) {
      const validation = validateFlightData(raw, airportCode);
      if (!validation.valid) continue;

      const isDeparture = raw.origin.toUpperCase() === airportCode.toUpperCase();
      const isArrival = raw.destination.toUpperCase() === airportCode.toUpperCase();

      if (isDeparture) {
        const norm = normalizeFlightData(raw, date, "departure", airportCode);
        if (norm) departures.push(norm);
      }
      if (isArrival) {
        const norm = normalizeFlightData(raw, date, "arrival", airportCode);
        if (norm) arrivals.push(norm);
      }
    }

    departures.sort((a, b) => a.scheduledTimestamp - b.scheduledTimestamp);
    arrivals.sort((a, b) => a.scheduledTimestamp - b.scheduledTimestamp);

    const result = {
      departures: departures.slice(0, MAX_FLIGHTS_PER_LIST),
      arrivals: arrivals.slice(0, MAX_FLIGHTS_PER_LIST),
    };
    setInCache(cacheKey, result);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao carregar voos";
    const technicalSummary = msg;

    console.error("[FlightBoard] API error:", {
      message: msg,
      technicalSummary,
      err,
    });

    const friendlyMsg =
      msg.includes("fetch") || msg.includes("network") || msg.includes("timeout")
        ? API_UNAVAILABLE_MSG
        : msg.includes("API") || msg.includes("401") || msg.includes("429")
          ? API_ERROR_MSG
          : API_UNAVAILABLE_MSG;

    return {
      departures: [],
      arrivals: [],
      error: friendlyMsg,
      technicalError: technicalSummary,
    };
  }
}

export { invalidateCache as invalidateFlightCache };

export function getDepartures(
  departures: FlightNormalized[],
  filters: { airlineCode?: string; flightNumber?: string }
): FlightNormalized[] {
  let list = [...departures];
  if (filters.airlineCode?.trim()) {
    list = list.filter((f) =>
      f.carrierCode.toUpperCase().includes(filters.airlineCode!.toUpperCase())
    );
  }
  if (filters.flightNumber?.trim()) {
    list = list.filter((f) =>
      f.flightNumber.toUpperCase().includes(filters.flightNumber!.toUpperCase())
    );
  }
  return list.slice(0, MAX_FLIGHTS_PER_LIST);
}

export function getArrivals(
  arrivals: FlightNormalized[],
  filters: { airlineCode?: string; flightNumber?: string }
): FlightNormalized[] {
  let list = [...arrivals];
  if (filters.airlineCode?.trim()) {
    list = list.filter((f) =>
      f.carrierCode.toUpperCase().includes(filters.airlineCode!.toUpperCase())
    );
  }
  if (filters.flightNumber?.trim()) {
    list = list.filter((f) =>
      f.flightNumber.toUpperCase().includes(filters.flightNumber!.toUpperCase())
    );
  }
  return list.slice(0, MAX_FLIGHTS_PER_LIST);
}
