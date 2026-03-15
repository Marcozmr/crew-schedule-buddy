import { FlightInfo } from './types';

const API_KEY = 'f886e6766dfc56f06bfc42da6e7ceb78';
const BASE_URL = 'http://api.aviationstack.com/v1';

export async function searchFlights(params: {
  flight_iata?: string;
  flight_icao?: string;
  dep_iata?: string;
  dep_icao?: string;
  arr_iata?: string;
  arr_icao?: string;
  airline_iata?: string;
  airline_icao?: string;
  airline_name?: string;
  flight_status?: string;
  flight_date?: string;
  min_delay_dep?: string;
  min_delay_arr?: string;
  limit?: string;
  offset?: string;
}): Promise<FlightInfo[]> {
  const queryParams = new URLSearchParams({ access_key: API_KEY });

  // Add all non-empty params
  Object.entries(params).forEach(([key, value]) => {
    if (value) queryParams.append(key, value);
  });

  // Default limit to max
  if (!params.limit) queryParams.append('limit', '100');

  try {
    const response = await fetch(`${BASE_URL}/flights?${queryParams.toString()}`);
    const data = await response.json();

    if (data.error) {
      console.error('AviationStack error:', data.error);
      return [];
    }

    return (data.data || []).map((flight: any) => ({
      ...flight,
      // Normalize nested objects that might be null
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
  // Clean the flight number
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
  // Free plan doesn't support direct registration search, fetch and filter
  const flights = await searchFlights({});
  return flights.filter(f =>
    f.aircraft?.registration?.toLowerCase().includes(registration.toLowerCase())
  );
}

export async function getAirports(search?: string) {
  const queryParams = new URLSearchParams({ access_key: API_KEY });
  if (search) queryParams.append('search', search);
  try {
    const response = await fetch(`${BASE_URL}/airports?${queryParams.toString()}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Failed to fetch airports:', error);
    return [];
  }
}

export async function getAirlines(search?: string) {
  const queryParams = new URLSearchParams({ access_key: API_KEY });
  if (search) queryParams.append('search', search);
  try {
    const response = await fetch(`${BASE_URL}/airlines?${queryParams.toString()}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Failed to fetch airlines:', error);
    return [];
  }
}
