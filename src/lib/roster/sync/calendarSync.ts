import { google } from 'googleapis'
import { getGoogleAuthClient } from './authGoogle.ts'
import type { DayOff, Flight, RosterJson } from '../types.ts'

type ExistingEventMap = Map<string, string>

function compareDateAsc(a: string, b: string): number {
  return a.localeCompare(b)
}

function toFlightKey(flight: Flight): string {
  return `flight:${flight.date}:${flight.flightNumber}`
}

function toDayOffKey(dayOff: DayOff): string {
  return `dayoff:${dayOff.date}:${dayOff.type.toUpperCase()}`
}

function extractDateFromEvent(
  event: google.calendar_v3.Schema$Event,
): string | null {
  return event.start?.date ?? event.start?.dateTime?.slice(0, 10) ?? null
}

function parseFallbackKey(event: google.calendar_v3.Schema$Event): string | null {
  const summary = event.summary ?? ''
  const eventDate = extractDateFromEvent(event)
  if (!eventDate) return null

  if (summary.startsWith('✈')) {
    const match = summary.match(/✈\s+([A-Z0-9]+)/i)
    if (!match) return null
    return `flight:${eventDate}:${match[1].toUpperCase()}`
  }

  if (summary.startsWith('🏖')) {
    const type = summary.replace(/^🏖\s*/, '').trim().toUpperCase()
    if (!type) return null
    return `dayoff:${eventDate}:${type}`
  }

  return null
}

function normalizeFlightNumber(flightNumber: string): string {
  return flightNumber.trim().toUpperCase()
}

async function fetchExistingEvents(
  calendarApi: ReturnType<typeof google.calendar>,
  calendarId: string,
  rosterJson: RosterJson,
): Promise<ExistingEventMap> {
  const allDates = [
    ...rosterJson.flights.map((flight) => flight.date),
    ...rosterJson.daysOff.map((dayOff) => dayOff.date),
  ].sort(compareDateAsc)

  if (!allDates.length) return new Map()

  const timeMin = `${allDates[0]}T00:00:00-03:00`
  const lastDate = allDates[allDates.length - 1]
  const timeMax = `${lastDate}T23:59:59-03:00`

  const existingEvents: ExistingEventMap = new Map()
  let pageToken: string | undefined

  do {
    const response = await calendarApi.events.list({
      calendarId,
      singleEvents: true,
      orderBy: 'startTime',
      timeMin,
      timeMax,
      maxResults: 2500,
      pageToken,
    })

    for (const item of response.data.items ?? []) {
      const eventId = item.id
      if (!eventId) continue

      const privateKey = item.extendedProperties?.private?.escalaxKey
      const fallbackKey = parseFallbackKey(item)
      const eventKey = privateKey ?? fallbackKey
      if (!eventKey) continue

      existingEvents.set(eventKey, eventId)
    }

    pageToken = response.data.nextPageToken ?? undefined
  } while (pageToken)

  return existingEvents
}

export async function syncRosterToCalendar(
  rosterJson: RosterJson,
  calendarId: string,
): Promise<void> {
  if (!calendarId.trim()) {
    throw new Error('calendarId não informado para sync do Google Calendar.')
  }

  if (!rosterJson.flights.length && !rosterJson.daysOff.length) {
    console.log('📅 Sem eventos para sincronizar no calendário.')
    return
  }

  console.log('📅 Iniciando sincronização com Google Calendar...')

  const authClient = await getGoogleAuthClient()
  const calendarApi = google.calendar({ version: 'v3', auth: authClient })
  const existingEvents = await fetchExistingEvents(calendarApi, calendarId, rosterJson)

  for (const flight of rosterJson.flights) {
    const flightNumber = normalizeFlightNumber(flight.flightNumber)
    const eventKey = `flight:${flight.date}:${flightNumber}`
    const eventTitle = `✈ ${flightNumber} ${flight.origin}→${flight.destination}`
    const eventPayload: google.calendar_v3.Schema$Event = {
      summary: eventTitle,
      description: [
        `Voo: ${flightNumber}`,
        `Origem: ${flight.origin}`,
        `Destino: ${flight.destination}`,
        `Saída: ${flight.departureTime}`,
        `Chegada: ${flight.arrivalTime}`,
      ].join('\n'),
      colorId: '9',
      start: {
        dateTime: `${flight.date}T${flight.departureTime}:00-03:00`,
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: `${flight.date}T${flight.arrivalTime}:00-03:00`,
        timeZone: 'America/Sao_Paulo',
      },
      extendedProperties: {
        private: { escalaxKey: eventKey },
      },
    }

    const existingEventId = existingEvents.get(eventKey)
    if (existingEventId) {
      await calendarApi.events.update({
        calendarId,
        eventId: existingEventId,
        requestBody: eventPayload,
      })
      console.log(`📅 ✅ Voo atualizado: ${eventTitle}`)
      continue
    }

    const insertResult = await calendarApi.events.insert({
      calendarId,
      requestBody: eventPayload,
    })

    if (insertResult.data.id) {
      existingEvents.set(eventKey, insertResult.data.id)
    }

    console.log(`📅 ✅ Voo criado: ${eventTitle}`)
  }

  for (const dayOff of rosterJson.daysOff) {
    const eventKey = toDayOffKey(dayOff)
    const eventTitle = `🏖 ${dayOff.type}`
    const nextDate = new Date(`${dayOff.date}T00:00:00`)
    nextDate.setUTCDate(nextDate.getUTCDate() + 1)
    const endDate = nextDate.toISOString().slice(0, 10)

    const eventPayload: google.calendar_v3.Schema$Event = {
      summary: eventTitle,
      description: dayOff.rawText,
      colorId: '2',
      start: { date: dayOff.date },
      end: { date: endDate },
      extendedProperties: {
        private: { escalaxKey: eventKey },
      },
    }

    const existingEventId = existingEvents.get(eventKey)
    if (existingEventId) {
      await calendarApi.events.update({
        calendarId,
        eventId: existingEventId,
        requestBody: eventPayload,
      })
      console.log(`📅 ✅ Folga atualizada: ${eventTitle} (${dayOff.date})`)
      continue
    }

    const insertResult = await calendarApi.events.insert({
      calendarId,
      requestBody: eventPayload,
    })

    if (insertResult.data.id) {
      existingEvents.set(eventKey, insertResult.data.id)
    }

    console.log(`📅 ✅ Folga criada: ${eventTitle} (${dayOff.date})`)
  }

  console.log('📅 ✅ Sincronização com calendário finalizada.')
}

export function buildRosterFingerprint(rosterJson: RosterJson): string {
  const normalizedFlights = [...rosterJson.flights]
    .map((flight) => ({
      ...flight,
      flightNumber: normalizeFlightNumber(flight.flightNumber),
    }))
    .sort((a, b) => toFlightKey(a).localeCompare(toFlightKey(b)))

  const normalizedDaysOff = [...rosterJson.daysOff]
    .map((dayOff) => ({
      ...dayOff,
      type: dayOff.type.trim().toUpperCase(),
    }))
    .sort((a, b) => toDayOffKey(a).localeCompare(toDayOffKey(b)))

  return JSON.stringify({
    flights: normalizedFlights,
    daysOff: normalizedDaysOff,
  })
}
