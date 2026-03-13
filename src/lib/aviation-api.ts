import { FlightInfo } from './types';

const API_KEY = 'f886e6766dfc56f06bfc42da6e7ceb78';
const BASE_URL = 'https://api.aviationstack.com/v1';

export async function searchFlights(params: {
  flight_iata?: string;
  dep_iata?: string;
  arr_iata?: string;
  airline_iata?: string;
  flight_status?: string;
}): Promise<FlightInfo[]> {
  const queryParams = new URLSearchParams({ access_key: API_KEY });
  
  Object.entries(params).forEach(([key, value]) => {
    if (value) queryParams.append(key, value);
  });

  try {
    const response = await fetch(`${BASE_URL}/flights?${queryParams.toString()}`);
    const data = await response.json();
    
    if (data.error) {
      console.error('AviationStack error:', data.error);
      return [];
    }
    
    return data.data || [];
  } catch (error) {
    console.error('Failed to fetch flights:', error);
    return [];
  }
}

export async function searchByAircraftRegistration(registration: string): Promise<FlightInfo[]> {
  // The free plan doesn't support aircraft registration search directly
  // We search all flights and filter client-side
  const flights = await searchFlights({});
  return flights.filter(f => 
    f.aircraft?.registration?.toLowerCase().includes(registration.toLowerCase())
  );
}

export async function getAirports() {
  const queryParams = new URLSearchParams({ access_key: API_KEY });
  try {
    const response = await fetch(`${BASE_URL}/airports?${queryParams.toString()}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Failed to fetch airports:', error);
    return [];
  }
}

export async function getAirlines() {
  const queryParams = new URLSearchParams({ access_key: API_KEY });
  try {
    const response = await fetch(`${BASE_URL}/airlines?${queryParams.toString()}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Failed to fetch airlines:', error);
    return [];
  }
}
