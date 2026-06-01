export interface Flight {
  date: string
  flightNumber: string
  origin: string
  destination: string
  departureTime: string
  arrivalTime: string
  rawText: string
}

export interface DayOff {
  date: string
  type: string
  rawText: string
}

export interface RosterJson {
  flights: Flight[]
  daysOff: DayOff[]
}
