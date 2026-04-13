/**
 * Camada isolada OpenSky — reutiliza padrões do flight-status (API OAuth).
 * Trocar provedor: implementar novo módulo com a mesma interface exportada.
 */

export const IATA_TO_ICAO: Record<string, string> = {
  GRU: "SBGR",
  CGH: "SBSP",
  VCP: "SBKP",
  GIG: "SBGL",
  SDU: "SBRJ",
  BSB: "SBBR",
  CNF: "SBCF",
  POA: "SBPA",
  SSA: "SBSV",
  REC: "SBRF",
  FOR: "SBFZ",
};

export function iataToIcao(iata: string): string | null {
  return IATA_TO_ICAO[iata.toUpperCase()] ?? null;
}

export function icaoToIata(icao: string): string {
  const u = (icao ?? "").toUpperCase();
  for (const [iata, icaoVal] of Object.entries(IATA_TO_ICAO)) {
    if (icaoVal === u) return iata;
  }
  return u.length >= 3 ? u.slice(1) : u || "UNK";
}

function utcHHMMFromUnix(sec: number): string {
  const d = new Date(sec * 1000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export type OpenSkyConfig = {
  openSkyBaseUrl: string;
  openSkyClientId: string | null;
  openSkyClientSecret: string | null;
};

export function readOpenSkyConfig(): OpenSkyConfig {
  return {
    openSkyBaseUrl: Deno.env.get("OPENSKY_BASE_URL") || "https://opensky-network.org/api",
    openSkyClientId: Deno.env.get("OPENSKY_CLIENT_ID")?.trim() || null,
    openSkyClientSecret: Deno.env.get("OPENSKY_CLIENT_SECRET")?.trim() || null,
  };
}

/** OpenSky pode responder em camelCase ou snake_case; normaliza para leitura estável. */
export function normalizeOpenSkyFlightRow(row: Record<string, unknown>): Record<string, unknown> {
  const o = { ...row };
  const map: [string, string][] = [
    ["est_departure_airport", "estDepartureAirport"],
    ["est_arrival_airport", "estArrivalAirport"],
    ["first_seen", "firstSeen"],
    ["last_seen", "lastSeen"],
  ];
  for (const [snake, camel] of map) {
    if (o[camel] == null && o[snake] != null) o[camel] = o[snake];
  }
  return o;
}

function openSkyAuthHeaders(cfg: OpenSkyConfig): Record<string, string> | undefined {
  if (!cfg.openSkyClientId || !cfg.openSkyClientSecret) return undefined;
  const basic = btoa(`${cfg.openSkyClientId}:${cfg.openSkyClientSecret}`);
  return { Authorization: `Basic ${basic}` };
}

export async function fetchOpenSkyAirportDayFlights(
  cfg: OpenSkyConfig,
  icao: string,
  begin: number,
  end: number,
): Promise<{ depRows: Record<string, unknown>[]; arrRows: Record<string, unknown>[] }> {
  const depUrl =
    `${cfg.openSkyBaseUrl}/flights/departure?airport=${encodeURIComponent(icao)}&begin=${begin}&end=${end}`;
  const arrUrl =
    `${cfg.openSkyBaseUrl}/flights/arrival?airport=${encodeURIComponent(icao)}&begin=${begin}&end=${end}`;
  const auth = openSkyAuthHeaders(cfg);
  const init: RequestInit = auth ? { headers: auth } : {};
  const [depRes, arrRes] = await Promise.all([fetch(depUrl, init), fetch(arrUrl, init)]);
  let depRows: Record<string, unknown>[] = [];
  let arrRows: Record<string, unknown>[] = [];
  try {
    const depJ = depRes.ok ? await depRes.json() : [];
    depRows = Array.isArray(depJ) ? depJ.map((r) => normalizeOpenSkyFlightRow(r as Record<string, unknown>)) : [];
  } catch {
    depRows = [];
  }
  try {
    const arrJ = arrRes.ok ? await arrRes.json() : [];
    arrRows = Array.isArray(arrJ) ? arrJ.map((r) => normalizeOpenSkyFlightRow(r as Record<string, unknown>)) : [];
  } catch {
    arrRows = [];
  }
  if (!auth && (depRows.length + arrRows.length === 0)) {
    console.log(
      JSON.stringify({
        event: "opensky_airport_fetch_empty_anon",
        dep_status: depRes.status,
        arr_status: arrRes.status,
        icao,
      }),
    );
  }
  return { depRows, arrRows };
}

export function parseOpenSkyRow(row: unknown[]): {
  callsign: string | null;
  icao24: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  onGround: boolean;
  velocity: number | null;
  heading: number | null;
  lastContact: number | null;
} | null {
  if (!Array.isArray(row) || row.length < 11) return null;
  const longitude = typeof row[5] === "number" ? row[5] : null;
  const latitude = typeof row[6] === "number" ? row[6] : null;
  if (latitude == null || longitude == null) return null;
  return {
    callsign: typeof row[1] === "string" ? row[1].trim() : null,
    icao24: typeof row[0] === "string" ? row[0] : null,
    longitude,
    latitude,
    altitude: typeof row[7] === "number" ? row[7] : null,
    onGround: row[8] === true,
    velocity: typeof row[9] === "number" ? row[9] : null,
    heading: typeof row[10] === "number" ? row[10] : null,
    lastContact: typeof row[4] === "number" ? row[4] : null,
  };
}

let statesCache: { expiresAt: number; states: ReturnType<typeof parseOpenSkyRow>[] } | null = null;
const STATES_TTL_MS = 60_000;

export async function fetchOpenSkyStates(cfg: OpenSkyConfig): Promise<NonNullable<ReturnType<typeof parseOpenSkyRow>>[]> {
  const now = Date.now();
  if (statesCache && now < statesCache.expiresAt) {
    return statesCache.states.filter(Boolean) as NonNullable<ReturnType<typeof parseOpenSkyRow>>[];
  }
  const auth = openSkyAuthHeaders(cfg);
  if (!auth) return [];
  try {
    const res = await fetch(`${cfg.openSkyBaseUrl}/states/all`, {
      headers: auth,
    });
    const data = await res.json();
    if (!res.ok) return [];
    const states = Array.isArray(data?.states)
      ? data.states.map((row: unknown[]) => parseOpenSkyRow(row)).filter(Boolean)
      : [];
    statesCache = { expiresAt: now + STATES_TTL_MS, states };
    return states as NonNullable<ReturnType<typeof parseOpenSkyRow>>[];
  } catch {
    return [];
  }
}

export function normalizeCallsign(value?: string | null): string {
  return (value ?? "").replace(/\s+/g, "").toUpperCase();
}

function buildExpectedCallsigns(airline: string, flightNum: string): Set<string> {
  const al = airline.replace(/\s+/g, "").toUpperCase();
  const num = flightNum.replace(/\D/g, "");
  const out = new Set<string>();
  if (al && num) {
    out.add(`${al}${num}`);
    out.add(`${al}${num.padStart(4, "0")}`);
  }
  return out;
}

export function rowMatchesFlightQuery(
  row: Record<string, unknown>,
  airline: string,
  flightNum: string,
): boolean {
  const callsign = row.callsign != null ? String(row.callsign).trim() : "";
  const expected = buildExpectedCallsigns(airline, flightNum);
  const cs = normalizeCallsign(callsign);
  if (expected.has(cs)) return true;
  const numOnly = flightNum.replace(/\D/g, "");
  if (numOnly && cs.endsWith(numOnly) && cs.startsWith(airline.toUpperCase().slice(0, 2))) return true;
  return false;
}

export type InternalFlightItem = {
  flightIdent: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  scheduledDeparture: string | null;
  estimatedDeparture: string | null;
  actualDeparture: string | null;
  scheduledArrival: string | null;
  estimatedArrival: string | null;
  actualArrival: string | null;
  status: string;
  statusLabel: string;
  aircraft: string | null;
  callsign: string | null;
  icao24: string | null;
  tracking: Record<string, unknown> | null;
};

function mapInternalStatus(
  row: Record<string, unknown>,
  role: "departure" | "arrival",
  nowMs: number,
): { status: string; statusLabel: string } {
  const firstSeen = Number(row.firstSeen);
  const lastSeen = Number(row.lastSeen);
  if (!Number.isFinite(firstSeen) || !Number.isFinite(lastSeen)) {
    return { status: "unknown", statusLabel: "Sem dados ao vivo" };
  }
  const depMs = firstSeen * 1000;
  const arrMs = lastSeen * 1000;
  if (nowMs > arrMs + 15 * 60 * 1000) {
    return { status: "landed", statusLabel: "Pousado" };
  }
  if (nowMs >= depMs && nowMs <= arrMs + 10 * 60 * 1000) {
    return { status: "active", statusLabel: "Em voo" };
  }
  if (nowMs < depMs - 2 * 60 * 60 * 1000) {
    return { status: "scheduled", statusLabel: "Programado" };
  }
  if (nowMs < depMs) {
    return { status: "scheduled", statusLabel: "Programado" };
  }
  return { status: "unknown", statusLabel: "Sem dados ao vivo" };
}

export function openSkyScheduleRowToInternal(
  row: Record<string, unknown>,
  role: "departure" | "arrival",
  /** IATA do aeroporto pesquisado — usado quando a API devolve ICAO nulo nos campos estimados. */
  airportContextIata?: string,
): InternalFlightItem | null {
  const icao24 = String(row.icao24 ?? "");
  const firstSeen = Number(row.firstSeen);
  const lastSeen = Number(row.lastSeen);
  const callsign = row.callsign != null ? String(row.callsign).trim() : null;
  const depIcao = row.estDepartureAirport != null ? String(row.estDepartureAirport).toUpperCase() : "";
  const arrIcao = row.estArrivalAirport != null ? String(row.estArrivalAirport).toUpperCase() : "";
  if (!icao24 || !Number.isFinite(firstSeen) || !Number.isFinite(lastSeen)) return null;

  let origin = depIcao ? icaoToIata(depIcao) : "UNK";
  let destination = arrIcao ? icaoToIata(arrIcao) : "UNK";
  if (airportContextIata) {
    if (role === "departure" && (!depIcao || origin === "UNK")) {
      origin = airportContextIata;
    }
    if (role === "arrival" && (!arrIcao || destination === "UNK")) {
      destination = airportContextIata;
    }
  }
  const depIso = new Date(firstSeen * 1000).toISOString();
  const arrIso = new Date(lastSeen * 1000).toISOString();
  const fnRaw = callsign ? callsign.replace(/\s+/g, "").toUpperCase() : `OSK${icao24.slice(-4)}`;
  let carrier = "OS";
  let flightNumDigits = fnRaw;
  const csMatch = fnRaw.match(/^([A-Z]{2,3})(\d[\w]*)$/);
  if (csMatch) {
    carrier = csMatch[1];
    flightNumDigits = csMatch[2].replace(/\D/g, "") || csMatch[2];
  } else if (fnRaw.length >= 2) {
    carrier = fnRaw.slice(0, 2);
    flightNumDigits = fnRaw.slice(2).replace(/^0+/, "") || fnRaw.slice(2);
  }
  const nowMs = Date.now();
  const st = mapInternalStatus(row, role, nowMs);

  return {
    flightIdent: `${carrier}-${fnRaw}-${icao24}-${role}`,
    airline: carrier,
    flightNumber: flightNumDigits || fnRaw,
    origin,
    destination,
    scheduledDeparture: depIso,
    estimatedDeparture: null,
    actualDeparture: null,
    scheduledArrival: arrIso,
    estimatedArrival: null,
    actualArrival: null,
    status: st.status,
    statusLabel: st.statusLabel,
    aircraft: null,
    callsign: callsign ?? fnRaw,
    icao24,
    tracking: null,
  };
}

export function attachTracking(
  item: InternalFlightItem,
  states: NonNullable<ReturnType<typeof parseOpenSkyRow>>[],
): InternalFlightItem {
  const target = normalizeCallsign(item.callsign || item.flightIdent);
  const num = item.flightNumber.replace(/\D/g, "");
  let m = states.find((s) => normalizeCallsign(s.callsign) === target);
  if (!m && num) {
    m = states.find((s) => normalizeCallsign(s.callsign ?? "").endsWith(num));
  }
  if (!m) return item;
  return {
    ...item,
    status: m.onGround === false ? "active" : item.status,
    statusLabel: m.onGround === false ? "Em voo" : item.statusLabel,
    tracking: {
      latitude: m.latitude,
      longitude: m.longitude,
      altitude: m.altitude,
      velocity: m.velocity,
      heading: m.heading,
      onGround: m.onGround,
      callsign: m.callsign,
      icao24: m.icao24,
      lastContact: m.lastContact,
    },
  };
}
