export interface CrewMember {
  id: string;
  name: string;
  email: string;
  airline: string;
  registration: string;
  avatar?: string;
}

export interface ScheduleEntry {
  id: string;
  date: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  departureTime: string;
  arrivalTime: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'active';
  aircraftPrefix?: string;
  airline?: string;
  reportTime?: string;
  dutyHours?: number;
}

export interface DashboardStats {
  totalFlightsMonth: number;
  totalHoursMonth: number;
  daysOff: number;
  nextFlight: ScheduleEntry | null;
  hoursWorked: number;
  hoursRemaining: number;
}

export interface FlightInfo {
  flight_date: string;
  flight_status: string;
  departure: {
    airport: string;
    timezone: string;
    iata: string;
    icao: string;
    terminal: string;
    gate: string;
    delay: number | null;
    scheduled: string;
    estimated: string;
    actual: string;
  };
  arrival: {
    airport: string;
    timezone: string;
    iata: string;
    icao: string;
    terminal: string;
    gate: string;
    delay: number | null;
    scheduled: string;
    estimated: string;
    actual: string;
  };
  airline: {
    name: string;
    iata: string;
    icao: string;
  };
  flight: {
    number: string;
    iata: string;
    icao: string;
  };
  aircraft: {
    registration: string;
    iata: string;
    icao: string;
    icao24: string;
  } | null;
  live: {
    updated: string;
    latitude: number;
    longitude: number;
    altitude: number;
    direction: number;
    speed_horizontal: number;
    speed_vertical: number;
    is_ground: boolean;
  } | null;
}
