import type { EcrewRosterJson } from './ecrew-roster-types.ts'
import type { DayOff, Flight, RosterJson } from '../types.ts'

function isIsoDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function normalizeFlight(flight: EcrewRosterJson['flights'][number]): Flight | null {
  if (!isIsoDate(flight.date)) return null

  return {
    date: flight.date,
    flightNumber: flight.flightNumber ?? 'N/A',
    origin: flight.origin ?? 'N/A',
    destination: flight.destination ?? 'N/A',
    departureTime: flight.departureTime ?? '00:00',
    arrivalTime: flight.arrivalTime ?? '00:00',
    rawText: flight.rawText,
  }
}

function normalizeDayOff(dayOff: EcrewRosterJson['daysOff'][number]): DayOff | null {
  if (!isIsoDate(dayOff.date)) return null

  return {
    date: dayOff.date,
    type: dayOff.label ?? 'folga',
    rawText: dayOff.rawText,
  }
}

export function toRosterJson(source: EcrewRosterJson): RosterJson {
  return {
    flights: source.flights
      .map((flight) => normalizeFlight(flight))
      .filter((flight): flight is Flight => Boolean(flight)),
    daysOff: source.daysOff
      .map((dayOff) => normalizeDayOff(dayOff))
      .filter((dayOff): dayOff is DayOff => Boolean(dayOff)),
  }
}
