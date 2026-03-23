/* eslint-disable @typescript-eslint/no-explicit-any */
import { FlightInfo } from './types';
import { supabase } from '@/integrations/supabase/client';

function toLegacyFlightInfo(raw: any): FlightInfo {
  const dep = raw?.departure ?? {};
  const arr = raw?.arrival ?? {};
  const tracking = raw?.tracking ?? null;
  const flightIata = raw?.flightNumber ?? '';
  const carrier = raw?.carrierCode ?? '';
  const number = flightIata.replace(carrier, '');

  return {
    flight_date: raw?.departure?.scheduledISO?.split?.('T')?.[0] ?? '',
    flight_status: raw?.status ?? 'scheduled',
    departure: {
      airport: dep.iata ?? dep.airport ?? dep.iataCode ?? '',
      timezone: '',
      iata: raw?.origin ?? '',
      icao: '',
      terminal: dep.terminal ?? null,
      gate: dep.gate ?? null,
      delay: raw?.delayMinutes ?? null,
      scheduled: dep.scheduledISO ?? dep.scheduled ?? '',
      estimated: dep.actualISO ?? dep.actual ?? null,
      actual: dep.actualISO ?? dep.actual ?? null,
      estimated_runway: null,
      actual_runway: null,
    },
    arrival: {
      airport: arr.iata ?? arr.airport ?? arr.iataCode ?? '',
      timezone: '',
      iata: raw?.destination ?? '',
      icao: '',
      terminal: arr.terminal ?? null,
      gate: arr.gate ?? null,
      delay: raw?.delayMinutes ?? null,
      scheduled: arr.scheduledISO ?? arr.scheduled ?? '',
      estimated: arr.actualISO ?? arr.actual ?? null,
      actual: arr.actualISO ?? arr.actual ?? null,
      estimated_runway: null,
      actual_runway: null,
      baggage: null,
    },
    airline: {
      name: carrier,
      iata: carrier,
      icao: '',
    },
    flight: {
      number,
      iata: flightIata,
      icao: '',
      codeshared: null,
    },
    aircraft: raw?.aircraftCode
      ? {
          registration: '',
          iata: raw.aircraftCode,
          icao: raw.aircraftCode,
          icao24: raw?.icao24 ?? '',
        }
      : null,
    live: tracking
      ? {
          updated: tracking.lastContact ? new Date(tracking.lastContact * 1000).toISOString() : new Date().toISOString(),
          latitude: tracking.latitude ?? 0,
          longitude: tracking.longitude ?? 0,
          altitude: tracking.altitude ?? 0,
          direction: tracking.heading ?? 0,
          speed_horizontal: tracking.velocity ?? 0,
          speed_vertical: 0,
          is_ground: tracking.onGround ?? false,
        }
      : null,
  };
}

async function callFlightStatus(params: Record<string, string> = {}): Promise<any> {
  const query: Record<string, string> = {};
  if (params.dep_iata) query.airportCode = params.dep_iata.toUpperCase();
  if (params.flight_iata) {
    const cleaned = params.flight_iata.replace(/\s/g, '').toUpperCase();
    const match = cleaned.match(/^([A-Z]{2})(\d+)/);
    if (match) {
      query.carrierCode = match[1];
      query.flightNumber = match[2];
    }
  }
  if (params.airline_iata) query.carrierCode = params.airline_iata.toUpperCase();
  if (params.flight_number) query.flightNumber = params.flight_number;
  if (!query.scheduledDepartureDate) {
    query.scheduledDepartureDate = new Date().toISOString().split('T')[0];
  }

  const { data, error } = await supabase.functions.invoke('flight-status', {
    method: 'GET',
    query,
  });

  if (error) {
    console.error('Flight status proxy error:', error);
    return { flights: [] };
  }

  return data;
}

export async function searchFlights(params: Record<string, string>): Promise<FlightInfo[]> {
  try {
    const data = await callFlightStatus(params);
    if (data.error) {
      console.error('Flight status error:', data.error);
      return [];
    }
    const flights = Array.isArray(data?.flights) ? data.flights : [];
    return flights.map((flight: any) => toLegacyFlightInfo(flight));
  } catch (error) {
    console.error('Failed to fetch flights:', error);
    return [];
  }
}

export async function searchByFlightNumber(flightNumber: string): Promise<FlightInfo[]> {
  const cleaned = flightNumber.replace(/\s/g, '').toUpperCase();
  return searchFlights({ flight_iata: cleaned });
}

export async function searchByRoute(depIata: string, arrIata: string): Promise<FlightInfo[]> {
  return searchFlights({
    dep_iata: depIata.toUpperCase(),
    arr_iata: arrIata.toUpperCase(),
  });
}

export async function searchByAircraftRegistration(registration: string): Promise<FlightInfo[]> {
  const flights = await searchFlights({});
  return flights.filter(f =>
    f.aircraft?.registration?.toLowerCase().includes(registration.toLowerCase())
  );
}

export async function getAirports(search?: string) {
  if (!search?.trim()) return [];
  const flights = await searchFlights({ dep_iata: search.trim().toUpperCase() });
  const codes = new Set<string>();
  flights.forEach((f) => {
    if (f.departure?.iata) codes.add(f.departure.iata);
    if (f.arrival?.iata) codes.add(f.arrival.iata);
  });
  return Array.from(codes).map((iata) => ({ iata_code: iata, airport_name: iata }));
}

export async function getAirlines(search?: string) {
  if (!search?.trim()) return [];
  const flights = await searchFlights({ airline_iata: search.trim().toUpperCase() });
  const codes = new Set<string>();
  flights.forEach((f) => {
    if (f.airline?.iata) codes.add(f.airline.iata);
  });
  return Array.from(codes).map((iata) => ({ iata_code: iata, airline_name: iata }));
}
