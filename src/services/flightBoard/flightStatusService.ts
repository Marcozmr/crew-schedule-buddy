/**
 * Busca status de um voo específico via Supabase Edge Function (Roster + OpenSky)
 */

import { getFromCache, setInCache, cacheKeys } from "./flightCache";
import { normalizeFlightData } from "./flightService";
import type { FlightNormalized, FlightRaw } from "./types";

function parseFlightNumber(input: string): { carrierCode?: string; flightNumber: string } {
  const numOnly = input.replace(/\D/g, "");
  const carrierMatch = input.match(/^([A-Za-z]{2})\s*(\d+)/);
  return {
    carrierCode: carrierMatch ? carrierMatch[1].toUpperCase() : undefined,
    flightNumber: carrierMatch ? carrierMatch[2] : numOnly || input.trim(),
  };
}

async function getFlightStatusFromSupabase(
  flight: string,
  date: string
): Promise<FlightRaw | null> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl?.trim() || !anonKey?.trim()) {
    throw new Error("Supabase não configurado para consulta de status");
  }

  const parsed = parseFlightNumber(flight);
  const params = new URLSearchParams();
  params.set("scheduledDepartureDate", date);
  params.set("flightNumber", parsed.flightNumber);
  if (parsed.carrierCode) params.set("carrierCode", parsed.carrierCode);

  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}/functions/v1/flight-status?${params.toString()}`,
    {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
    }
  );
  const data = await response.json();
  if (!response.ok) return null;
  const flights = Array.isArray(data?.flights) ? (data.flights as FlightRaw[]) : [];
  return flights[0] ?? null;
}

export interface FlightStatusResult {
  flight: FlightNormalized | null;
  error?: string;
}

export async function getFlightStatus(
  flightNumber: string,
  date?: string
): Promise<FlightStatusResult> {
  const dateStr = date ?? new Date().toISOString().split("T")[0];
  const cacheKey = cacheKeys.flightStatus(flightNumber, dateStr);

  const cached = getFromCache<FlightNormalized>(cacheKey);
  if (cached) return { flight: cached };

  try {
    const raw = await getFlightStatusFromSupabase(flightNumber, dateStr);

    if (!raw) {
      return { flight: null, error: "Voo não encontrado" };
    }

    const normalized = normalizeFlightData(raw, dateStr, "departure", raw.origin);
    if (!normalized) return { flight: null, error: "Voo não encontrado" };
    setInCache(cacheKey, normalized);
    return { flight: normalized };
  } catch (err) {
    return {
      flight: null,
      error: err instanceof Error ? err.message : "Erro ao buscar status do voo",
    };
  }
}
