/**
 * Orquestra modos flight | airport sobre OpenSkyProvider.
 */

import {
  type InternalFlightItem,
  type OpenSkyConfig,
  readOpenSkyConfig,
  fetchOpenSkyAirportDayFlights,
  fetchOpenSkyStates,
  openSkyScheduleRowToInternal,
  attachTracking,
  rowMatchesFlightQuery,
  iataToIcao,
  normalizeCallsign,
  normalizeOpenSkyFlightRow,
} from "./opensky.ts";

export type SearchPayload = {
  mode: "flight" | "airport";
  direction: "departure" | "arrival";
  airport?: string;
  date: string;
  airline?: string;
  flightNumber?: string;
};

function dayBoundsUtc(dateIso: string): { begin: number; end: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return null;
  const begin = Math.floor(new Date(`${dateIso}T00:00:00.000Z`).getTime() / 1000);
  const end = begin + 86400 - 1;
  return { begin, end };
}

function dedupe(items: InternalFlightItem[]): InternalFlightItem[] {
  const seen = new Set<string>();
  const out: InternalFlightItem[] = [];
  for (const it of items) {
    const k = `${it.icao24}|${it.scheduledDeparture}|${it.scheduledArrival}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

export async function runFlightSearch(payload: SearchPayload): Promise<{
  items: InternalFlightItem[];
  source: string;
  hint?: string;
}> {
  const cfg = readOpenSkyConfig();
  const bounds = dayBoundsUtc(payload.date);
  if (!bounds) {
    return { items: [], source: "opensky", hint: "invalid_date" };
  }

  const airline = (payload.airline ?? "").trim().toUpperCase();
  const flightNum = (payload.flightNumber ?? "").trim();

  if (payload.mode === "airport") {
    const ap = (payload.airport ?? "").trim().toUpperCase();
    if (!ap || ap.length !== 3) {
      return { items: [], source: "opensky", hint: "airport_required" };
    }
    const icao = iataToIcao(ap);
    if (!icao) {
      return { items: [], source: "opensky", hint: "unknown_airport_iata" };
    }
    const { depRows, arrRows } = await fetchOpenSkyAirportDayFlights(cfg, icao, bounds.begin, bounds.end);
    const items: InternalFlightItem[] = [];
    for (const row of depRows) {
      if (typeof row !== "object" || !row) continue;
      const nr = normalizeOpenSkyFlightRow(row as Record<string, unknown>);
      const it = openSkyScheduleRowToInternal(nr, "departure", ap);
      if (it && (it.origin === ap || it.destination === ap)) {
        if (airline && !String(it.airline).toUpperCase().startsWith(airline)) continue;
        if (flightNum && !String(it.flightNumber).includes(flightNum.replace(/\D/g, ""))) continue;
        items.push(it);
      }
    }
    for (const row of arrRows) {
      if (typeof row !== "object" || !row) continue;
      const nr = normalizeOpenSkyFlightRow(row as Record<string, unknown>);
      const it = openSkyScheduleRowToInternal(nr, "arrival", ap);
      if (it && (it.origin === ap || it.destination === ap)) {
        if (airline && !String(it.airline).toUpperCase().startsWith(airline)) continue;
        if (flightNum && !String(it.flightNumber).includes(flightNum.replace(/\D/g, ""))) continue;
        items.push(it);
      }
    }
    const states = await fetchOpenSkyStates(cfg);
    const enriched = dedupe(items).map((it) => attachTracking(it, states));
    return { items: enriched, source: "opensky" };
  }

  /* mode === flight */
  if (!airline || !flightNum) {
    return { items: [], source: "opensky", hint: "airline_and_flight_required" };
  }

  const ap = (payload.airport ?? "").trim().toUpperCase();
  if (ap && ap.length === 3) {
    const icao = iataToIcao(ap);
    if (!icao) {
      return { items: [], source: "opensky", hint: "unknown_airport_iata" };
    }
    const { depRows, arrRows } = await fetchOpenSkyAirportDayFlights(cfg, icao, bounds.begin, bounds.end);
    const candidates: InternalFlightItem[] = [];
    for (const row of depRows) {
      if (typeof row !== "object" || !row) continue;
      const nr = normalizeOpenSkyFlightRow(row as Record<string, unknown>);
      if (!rowMatchesFlightQuery(nr, airline, flightNum)) continue;
      const it = openSkyScheduleRowToInternal(nr, "departure", ap);
      if (it) candidates.push(it);
    }
    for (const row of arrRows) {
      if (typeof row !== "object" || !row) continue;
      const nr = normalizeOpenSkyFlightRow(row as Record<string, unknown>);
      if (!rowMatchesFlightQuery(nr, airline, flightNum)) continue;
      const it = openSkyScheduleRowToInternal(nr, "arrival", ap);
      if (it) candidates.push(it);
    }
    const states = await fetchOpenSkyStates(cfg);
    return {
      items: dedupe(candidates).map((it) => attachTracking(it, states)),
      source: "opensky",
    };
  }

  /* Sem aeroporto: apenas estados ao vivo (limitado) */
  const states = await fetchOpenSkyStates(cfg);
  const expected = new Set<string>();
  const al = airline.replace(/\s+/g, "").toUpperCase();
  const num = flightNum.replace(/\D/g, "");
  if (al && num) {
    expected.add(`${al}${num}`);
    expected.add(`${al}${num.padStart(4, "0")}`);
  }
  const items: InternalFlightItem[] = [];
  for (const s of states) {
    const cs = normalizeCallsign(s.callsign);
    if (!cs || !expected.has(cs)) {
      if (!num || !cs.endsWith(num)) continue;
    }
    items.push({
      flightIdent: `live-${s.icao24}-${cs}`,
      airline: al,
      flightNumber: num || cs.replace(/^[A-Z]+/i, ""),
      origin: "—",
      destination: "—",
      scheduledDeparture: null,
      estimatedDeparture: null,
      actualDeparture: null,
      scheduledArrival: null,
      estimatedArrival: null,
      actualArrival: null,
      status: s.onGround ? "unknown" : "active",
      statusLabel: s.onGround ? "Sem dados ao vivo" : "Em voo",
      aircraft: null,
      callsign: s.callsign,
      icao24: s.icao24,
      tracking: {
        latitude: s.latitude,
        longitude: s.longitude,
        altitude: s.altitude,
        velocity: s.velocity,
        heading: s.heading,
        onGround: s.onGround,
        callsign: s.callsign,
        icao24: s.icao24,
        lastContact: s.lastContact,
      },
    });
  }
  return {
    items: dedupe(items),
    source: "opensky",
    hint: items.length === 0 ? "airport_recommended_for_ground" : undefined,
  };
}
