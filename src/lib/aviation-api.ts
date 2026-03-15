import { FlightInfo } from './types';
import { supabase } from '@/integrations/supabase/client';

async function callProxy(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const { data, error } = await supabase.functions.invoke('aviation-proxy', {
    body: { endpoint, params },
  });

  if (error) {
    console.error('Aviation proxy error:', error);
    return { data: [] };
  }

  return data;
}

export async function searchFlights(params: Record<string, string>): Promise<FlightInfo[]> {
  if (!params.limit) params.limit = '100';

  try {
    const data = await callProxy('flights', params);

    if (data.error) {
      console.error('AviationStack error:', data.error);
      return [];
    }

    return (data.data || []).map((flight: any) => ({
      ...flight,
      departure: flight.departure || {},
      arrival: flight.arrival || {},
      airline: flight.airline || {},
      flight: flight.flight || {},
      aircraft: flight.aircraft || null,
      live: flight.live || null,
    }));
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
  const params: Record<string, string> = {};
  if (search) params.search = search;
  try {
    const data = await callProxy('airports', params);
    return data.data || [];
  } catch (error) {
    console.error('Failed to fetch airports:', error);
    return [];
  }
}

export async function getAirlines(search?: string) {
  const params: Record<string, string> = {};
  if (search) params.search = search;
  try {
    const data = await callProxy('airlines', params);
    return data.data || [];
  } catch (error) {
    console.error('Failed to fetch airlines:', error);
    return [];
  }
}
