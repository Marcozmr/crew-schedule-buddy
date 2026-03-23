/**
 * Abstração de provedores de API de voos
 * Fluxo principal: Supabase Edge Function flight-status (Roster + OpenSky)
 */

import type { FlightProvider, FlightProviderOptions } from "./types";
import type { FlightRaw } from "./types";

export type ProviderType = "supabase" | "mock";

function hasSupabaseConfig(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return !!(url?.trim() && key?.trim());
}

/**
 * Factory para obter o provedor ativo.
 * Fluxo oficial: Supabase (Roster + OpenSky). Mock apenas em dev quando habilitado.
 */
export function createFlightProvider(): FlightProvider {
  if (hasSupabaseConfig()) {
    return createSupabaseProvider();
  }
  const isProd = import.meta.env.PROD;
  if (isProd) {
    return createSupabaseProvider();
  }
  const useMock = import.meta.env.VITE_FLIGHT_USE_MOCK !== "false";
  if (useMock) return createMockProvider();
  return createSupabaseProvider();
}

/** Retorna o tipo do provedor ativo (útil para debug/UX) */
export function getActiveProviderType(): ProviderType {
  if (hasSupabaseConfig()) return "supabase";
  if (!import.meta.env.PROD && import.meta.env.VITE_FLIGHT_USE_MOCK !== "false")
    return "mock";
  return "supabase";
}

/** Mock provider para desenvolvimento e fallback */
function createMockProvider(): FlightProvider {
  return { getFlights: getMockFlights };
}

/** Provedor que chama a Supabase Edge Function (Roster + OpenSky) */
function createSupabaseProvider(): FlightProvider {
  return { getFlights: getSupabaseFlights };
}

export async function getMockFlights(options: FlightProviderOptions): Promise<FlightRaw[]> {
  const { airportCode, date } = options;
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const isToday = date === today;

  const baseHour = isToday ? now.getHours() : 6;
  const baseMin = isToday ? now.getMinutes() : 0;

  const generateTime = (hOffset: number, mOffset: number) => {
    let totalMins = (baseHour * 60 + baseMin) + (hOffset * 60 + mOffset);
    while (totalMins < 0) totalMins += 24 * 60;
    totalMins = totalMins % (24 * 60);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const mockDepartures: FlightRaw[] = [
    {
      id: "LA3456-dep-1",
      flightNumber: "LA3456",
      carrierCode: "LA",
      origin: airportCode,
      destination: "EZE",
      departure: { scheduled: generateTime(0, 15), actual: null, terminal: "3", gate: "D4" },
      arrival: { scheduled: generateTime(3, 45), actual: null, terminal: null, gate: null },
      aircraftCode: "332",
      status: "BOARDING",
    },
    {
      id: "G31234-dep-2",
      flightNumber: "G31234",
      carrierCode: "G3",
      origin: airportCode,
      destination: "BSB",
      departure: { scheduled: generateTime(0, 45), actual: null, terminal: "2", gate: "A12" },
      arrival: { scheduled: generateTime(1, 45), actual: null, terminal: null, gate: null },
      aircraftCode: "738",
      status: "SCHEDULED",
    },
    {
      id: "AD4567-dep-3",
      flightNumber: "AD4567",
      carrierCode: "AD",
      origin: airportCode,
      destination: "REC",
      departure: { scheduled: generateTime(1, 30), actual: generateTime(1, 55), terminal: "1", gate: "B8" },
      arrival: { scheduled: generateTime(3, 30), actual: null, terminal: null, gate: null },
      aircraftCode: "320",
      status: "DELAYED",
    },
    {
      id: "LA3457-dep-4",
      flightNumber: "LA3457",
      carrierCode: "LA",
      origin: airportCode,
      destination: "SCL",
      departure: { scheduled: generateTime(2, 0), actual: null, terminal: "3", gate: "E2" },
      arrival: { scheduled: generateTime(5, 30), actual: null, terminal: null, gate: null },
      aircraftCode: "321",
      status: "SCHEDULED",
    },
    {
      id: "G31256-dep-5",
      flightNumber: "G31256",
      carrierCode: "G3",
      origin: airportCode,
      destination: "CNF",
      departure: { scheduled: generateTime(2, 45), actual: null, terminal: "2", gate: null },
      arrival: { scheduled: generateTime(3, 45), actual: null, terminal: null, gate: null },
      aircraftCode: "738",
      status: "SCHEDULED",
    },
    {
      id: "AD4589-dep-6",
      flightNumber: "AD4589",
      carrierCode: "AD",
      origin: airportCode,
      destination: "SSA",
      departure: { scheduled: generateTime(3, 15), actual: null, terminal: "1", gate: "C3" },
      arrival: { scheduled: generateTime(4, 45), actual: null, terminal: null, gate: null },
      aircraftCode: "320",
      status: "SCHEDULED",
    },
    {
      id: "LA3460-dep-7",
      flightNumber: "LA3460",
      carrierCode: "LA",
      origin: airportCode,
      destination: "MIA",
      departure: { scheduled: generateTime(4, 0), actual: null, terminal: "3", gate: "E5" },
      arrival: { scheduled: generateTime(10, 30), actual: null, terminal: null, gate: null },
      aircraftCode: "77W",
      status: "SCHEDULED",
    },
    {
      id: "G31100-dep-8",
      flightNumber: "G31100",
      carrierCode: "G3",
      origin: airportCode,
      destination: "GIG",
      departure: { scheduled: generateTime(4, 30), actual: null, terminal: "2", gate: "A5" },
      arrival: { scheduled: generateTime(5, 25), actual: null, terminal: null, gate: null },
      aircraftCode: "738",
      status: "SCHEDULED",
    },
    {
      id: "AD4600-dep-9",
      flightNumber: "AD4600",
      carrierCode: "AD",
      origin: airportCode,
      destination: "CGH",
      departure: { scheduled: generateTime(5, 0), actual: null, terminal: "1", gate: null },
      arrival: { scheduled: generateTime(5, 35), actual: null, terminal: null, gate: null },
      aircraftCode: "E90",
      status: "SCHEDULED",
    },
    {
      id: "LA3465-dep-10",
      flightNumber: "LA3465",
      carrierCode: "LA",
      origin: airportCode,
      destination: "BOG",
      departure: { scheduled: generateTime(5, 45), actual: null, terminal: "3", gate: "D2" },
      arrival: { scheduled: generateTime(9, 15), actual: null, terminal: null, gate: null },
      aircraftCode: "321",
      status: "SCHEDULED",
    },
  ];

  const mockArrivals: FlightRaw[] = [
    {
      id: "LA3455-arr-1",
      flightNumber: "LA3455",
      carrierCode: "LA",
      origin: "SCL",
      destination: airportCode,
      departure: { scheduled: generateTime(-5, 30), actual: null, terminal: null, gate: null },
      arrival: { scheduled: generateTime(-2, 0), actual: null, terminal: "3", gate: "D4" },
      aircraftCode: "321",
      status: "LANDED",
    },
    {
      id: "G31230-arr-2",
      flightNumber: "G31230",
      carrierCode: "G3",
      origin: "BSB",
      destination: airportCode,
      departure: { scheduled: generateTime(-2, 0), actual: null, terminal: null, gate: null },
      arrival: { scheduled: generateTime(-0, 30), actual: generateTime(-0, 15), terminal: "2", gate: "A12" },
      aircraftCode: "738",
      status: "ARRIVED",
    },
    {
      id: "AD4560-arr-3",
      flightNumber: "AD4560",
      carrierCode: "AD",
      origin: "REC",
      destination: airportCode,
      departure: { scheduled: generateTime(-3, 0), actual: null, terminal: null, gate: null },
      arrival: { scheduled: generateTime(-0, 15), actual: null, terminal: "1", gate: "B8" },
      aircraftCode: "320",
      status: "LANDED",
    },
    {
      id: "LA3450-arr-4",
      flightNumber: "LA3450",
      carrierCode: "LA",
      origin: "EZE",
      destination: airportCode,
      departure: { scheduled: generateTime(-3, 45), actual: null, terminal: null, gate: null },
      arrival: { scheduled: generateTime(0, 30), actual: null, terminal: "3", gate: "E2" },
      aircraftCode: "332",
      status: "SCHEDULED",
    },
    {
      id: "G31240-arr-5",
      flightNumber: "G31240",
      carrierCode: "G3",
      origin: "CNF",
      destination: airportCode,
      departure: { scheduled: generateTime(-2, 30), actual: null, terminal: null, gate: null },
      arrival: { scheduled: generateTime(1, 0), actual: null, terminal: "2", gate: null },
      aircraftCode: "738",
      status: "SCHEDULED",
    },
    {
      id: "AD4570-arr-6",
      flightNumber: "AD4570",
      carrierCode: "AD",
      origin: "SSA",
      destination: airportCode,
      departure: { scheduled: generateTime(-2, 0), actual: null, terminal: null, gate: null },
      arrival: { scheduled: generateTime(1, 30), actual: null, terminal: "1", gate: "C3" },
      aircraftCode: "320",
      status: "SCHEDULED",
    },
    {
      id: "UA800-arr-7",
      flightNumber: "UA800",
      carrierCode: "UA",
      origin: "IAH",
      destination: airportCode,
      departure: { scheduled: generateTime(-8, 0), actual: null, terminal: null, gate: null },
      arrival: { scheduled: generateTime(2, 0), actual: null, terminal: "3", gate: "E5" },
      aircraftCode: "788",
      status: "SCHEDULED",
    },
    {
      id: "G31090-arr-8",
      flightNumber: "G31090",
      carrierCode: "G3",
      origin: "GIG",
      destination: airportCode,
      departure: { scheduled: generateTime(-1, 30), actual: null, terminal: null, gate: null },
      arrival: { scheduled: generateTime(2, 30), actual: null, terminal: "2", gate: "A5" },
      aircraftCode: "738",
      status: "SCHEDULED",
    },
    {
      id: "AD4595-arr-9",
      flightNumber: "AD4595",
      carrierCode: "AD",
      origin: "CGH",
      destination: airportCode,
      departure: { scheduled: generateTime(-1, 0), actual: null, terminal: null, gate: null },
      arrival: { scheduled: generateTime(3, 0), actual: null, terminal: "1", gate: null },
      aircraftCode: "E90",
      status: "SCHEDULED",
    },
    {
      id: "LA3452-arr-10",
      flightNumber: "LA3452",
      carrierCode: "LA",
      origin: "BOG",
      destination: airportCode,
      departure: { scheduled: generateTime(-4, 30), actual: null, terminal: null, gate: null },
      arrival: { scheduled: generateTime(3, 30), actual: null, terminal: "3", gate: "D2" },
      aircraftCode: "321",
      status: "SCHEDULED",
    },
  ];

  return [...mockDepartures, ...mockArrivals];
}

async function getSupabaseFlights(options: FlightProviderOptions): Promise<FlightRaw[]> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!baseUrl || !anonKey) {
    throw new Error("Variáveis do Supabase não configuradas");
  }

  const params = new URLSearchParams();
  params.set("airportCode", options.airportCode.toUpperCase());
  params.set("scheduledDepartureDate", options.date);
  if (options.airlineCode?.trim()) params.set("carrierCode", options.airlineCode.trim().toUpperCase());
  if (options.flightNumber?.trim()) params.set("flightNumber", options.flightNumber.trim());

  const response = await fetch(`${baseUrl}/functions/v1/flight-status?${params.toString()}`, {
    method: "GET",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Erro na consulta");
  }

  return data.flights ?? [];
}
