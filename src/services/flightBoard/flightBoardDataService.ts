import { getFlightsByAirport } from "./flightService";
import type { FlightBoardData } from "./types";

export async function getFlightBoardData(options: {
  airportCode: string;
  date: string;
  mode: "departures" | "arrivals";
  airlineCode?: string;
  flightNumber?: string;
  skipCache?: boolean;
}): Promise<{ flights: FlightBoardData[]; error?: string; technicalError?: string }> {
  const result = await getFlightsByAirport(
    options.airportCode,
    options.date,
    options.airlineCode,
    options.flightNumber,
    { skipCache: options.skipCache }
  );
  const list = options.mode === "departures" ? result.departures : result.arrivals;

  const flights: FlightBoardData[] = list.map((item) => ({
    flightNumber: item.flightNumber,
    airline: item.airlineName,
    departureAirport: item.origin,
    arrivalAirport: item.destination,
    scheduledDeparture: options.mode === "departures" ? item.scheduledTime : null,
    estimatedDeparture: options.mode === "departures" ? item.estimatedTime : null,
    scheduledArrival: options.mode === "arrivals" ? item.scheduledTime : null,
    estimatedArrival: options.mode === "arrivals" ? item.estimatedTime : null,
    presentationTime: options.mode === "departures" ? item.scheduledTime : null,
    terminal: item.terminal,
    gate: item.gate,
    delayMinutes: item.delayMinutes,
    status: item.statusLabel,
    aircraft: item.aircraft,
    airportInfo: item.airportInfo ?? null,
    tracking: item.tracking ?? null,
  }));

  return {
    flights,
    error: result.error,
    technicalError: result.technicalError,
  };
}
