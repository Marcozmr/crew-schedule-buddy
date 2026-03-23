/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROSTER_TTL_MS = 5 * 60 * 1000;
const TRACKING_TTL_MS_HIGH = 30 * 1000;
const TRACKING_TTL_MS_MEDIUM = 60 * 1000;

const rosterCache = new Map<string, { expiresAt: number; data: any }>();
const airportBaseCache = new Map<string, { expiresAt: number; data: any }>();
let openSkyStatesCache: { expiresAt: number; states: any[] } | null = null;
const trackingCache = new Map<string, { expiresAt: number; tracking: any | null }>();

const AIRPORT_BASE_CACHE_TTL_MS = 60 * 1000;
const OPENSKY_STATES_CACHE_TTL_MS = 60 * 1000;

/** IATA → ICAO (OpenSky) — bases BR cobertas pelo AIRPORT_DB */
const IATA_TO_ICAO: Record<string, string> = {
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

function iataToIcao(iata: string): string | null {
  return IATA_TO_ICAO[iata.toUpperCase()] ?? null;
}

function icaoToIata(icao: string): string {
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

const AIRPORT_DB: Record<string, { name: string; city: string; country: string; timezone: string }> = {
  GRU: { name: "Aeroporto Internacional de Guarulhos", city: "Sao Paulo", country: "Brazil", timezone: "America/Sao_Paulo" },
  CGH: { name: "Aeroporto de Congonhas", city: "Sao Paulo", country: "Brazil", timezone: "America/Sao_Paulo" },
  VCP: { name: "Aeroporto de Viracopos", city: "Campinas", country: "Brazil", timezone: "America/Sao_Paulo" },
  GIG: { name: "Aeroporto Internacional do Galeao", city: "Rio de Janeiro", country: "Brazil", timezone: "America/Sao_Paulo" },
  SDU: { name: "Aeroporto Santos Dumont", city: "Rio de Janeiro", country: "Brazil", timezone: "America/Sao_Paulo" },
  BSB: { name: "Aeroporto Internacional de Brasilia", city: "Brasilia", country: "Brazil", timezone: "America/Sao_Paulo" },
  CNF: { name: "Aeroporto Internacional de Confins", city: "Belo Horizonte", country: "Brazil", timezone: "America/Sao_Paulo" },
  POA: { name: "Aeroporto Salgado Filho", city: "Porto Alegre", country: "Brazil", timezone: "America/Sao_Paulo" },
  SSA: { name: "Aeroporto Internacional de Salvador", city: "Salvador", country: "Brazil", timezone: "America/Bahia" },
  REC: { name: "Aeroporto Internacional do Recife", city: "Recife", country: "Brazil", timezone: "America/Recife" },
  FOR: { name: "Aeroporto Internacional de Fortaleza", city: "Fortaleza", country: "Brazil", timezone: "America/Fortaleza" },
};

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function toIso(date: string, hhmm: string | null | undefined): string | null {
  if (!date || !hhmm) return null;
  const m = String(hhmm).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = m[1].padStart(2, "0");
  const mm = m[2];
  return `${date}T${hh}:${mm}:00.000Z`;
}

function normalizeCallsign(value?: string | null): string {
  return (value ?? "").replace(/\s+/g, "").toUpperCase();
}

function parseOpenSkyRow(row: unknown[]): any | null {
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

function getAirportInfo(iata?: string | null) {
  if (!iata) return null;
  const code = iata.toUpperCase();
  const row = AIRPORT_DB[code];
  if (row) {
    return { ...row, iata: code };
  }
  return {
    name: code,
    city: code,
    country: "Unknown",
    timezone: "UTC",
    iata: code,
  };
}

function calculateInternalStatus(flight: any, nowMs: number, isNextFlight: boolean): string {
  const depMs = flight.departure?.scheduledISO ? new Date(flight.departure.scheduledISO).getTime() : null;
  const arrMs = flight.arrival?.scheduledISO ? new Date(flight.arrival.scheduledISO).getTime() : null;
  const briefingMs = flight.presentationTimeISO ? new Date(flight.presentationTimeISO).getTime() : null;

  if (flight.tracking && flight.tracking.onGround === false) return "AIRBORNE";
  if (flight.tracking && flight.tracking.onGround === true && depMs && arrMs && nowMs >= depMs - 30 * 60 * 1000 && nowMs <= arrMs + 30 * 60 * 1000) {
    return "ON_GROUND";
  }
  if (arrMs && nowMs > arrMs + 30 * 60 * 1000) return "COMPLETED";
  if (depMs && arrMs && nowMs >= depMs && nowMs <= arrMs + 10 * 60 * 1000) return "IN_PROGRESS";
  if (briefingMs && nowMs >= briefingMs && depMs && nowMs < depMs) return "BRIEFING";
  if (isNextFlight) return "NEXT_FLIGHT";
  return "UPCOMING";
}

function readBackendConfig() {
  const cfg = {
    openSkyBaseUrl: Deno.env.get("OPENSKY_BASE_URL") || "https://opensky-network.org/api",
    openSkyClientId: Deno.env.get("OPENSKY_CLIENT_ID"),
    openSkyClientSecret: Deno.env.get("OPENSKY_CLIENT_SECRET"),
    supabaseUrl: Deno.env.get("SUPABASE_URL"),
    supabaseServiceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  };
  if (!cfg.supabaseUrl || !cfg.supabaseServiceRoleKey) {
    throw new Error("Supabase service role não configurado");
  }
  const hasOpenSky = !!(cfg.openSkyClientId && cfg.openSkyClientSecret);
  console.log("[flight-status] config", {
    hasOpenSky,
    openSkyUrl: cfg.openSkyBaseUrl?.slice(0, 40) ?? "(ausente)",
  });
  if (!hasOpenSky) {
    console.warn("[flight-status] OPENSKY_CLIENT_ID ou OPENSKY_CLIENT_SECRET ausentes; tracking/airport_base opcional.");
  }
  return cfg;
}

async function fetchOpenSkyStates(cfg: ReturnType<typeof readBackendConfig>): Promise<any[]> {
  const now = Date.now();
  if (openSkyStatesCache && now < openSkyStatesCache.expiresAt) return openSkyStatesCache.states;
  if (!cfg.openSkyClientId || !cfg.openSkyClientSecret) return [];

  const basic = btoa(`${cfg.openSkyClientId}:${cfg.openSkyClientSecret}`);
  try {
    const res = await fetch(`${cfg.openSkyBaseUrl}/states/all`, {
      headers: { Authorization: `Basic ${basic}` },
    });
    const data = await res.json();
    if (!res.ok) return [];
    const states = Array.isArray(data?.states)
      ? data.states.map((row: unknown[]) => parseOpenSkyRow(row)).filter(Boolean)
      : [];
    openSkyStatesCache = { expiresAt: now + OPENSKY_STATES_CACHE_TTL_MS, states };
    return states;
  } catch {
    return [];
  }
}

function matchTracking(flight: any, states: any[]): any | null {
  const callsignTarget = normalizeCallsign(flight.callsign || flight.flightNumber);
  const numberOnly = String(flight.flightNumber ?? "").replace(/\D/g, "");
  if (!callsignTarget && !numberOnly) return null;

  const exact = states.find((s) => normalizeCallsign(s.callsign) === callsignTarget);
  if (exact) return exact;
  if (numberOnly) return states.find((s) => normalizeCallsign(s.callsign).endsWith(numberOnly)) ?? null;
  return null;
}

function buildTrackingCacheKey(flight: any): string {
  const dep = flight.departure?.scheduledISO ? String(flight.departure.scheduledISO).slice(0, 16) : "no-dep";
  const id = normalizeCallsign(flight.callsign || flight.flightNumber) || String(flight.flightNumber ?? "unknown");
  return `${id}|${dep}`;
}

async function fetchOpenSkyAirportDayFlights(
  cfg: ReturnType<typeof readBackendConfig>,
  icao: string,
  begin: number,
  end: number
): Promise<{ depRows: any[]; arrRows: any[]; httpDep: number; httpArr: number }> {
  if (!cfg.openSkyClientId || !cfg.openSkyClientSecret) {
    return { depRows: [], arrRows: [], httpDep: 0, httpArr: 0 };
  }
  const basic = btoa(`${cfg.openSkyClientId}:${cfg.openSkyClientSecret}`);
  const depUrl = `${cfg.openSkyBaseUrl}/flights/departure?airport=${encodeURIComponent(icao)}&begin=${begin}&end=${end}`;
  const arrUrl = `${cfg.openSkyBaseUrl}/flights/arrival?airport=${encodeURIComponent(icao)}&begin=${begin}&end=${end}`;
  const [depRes, arrRes] = await Promise.all([
    fetch(depUrl, { headers: { Authorization: `Basic ${basic}` } }),
    fetch(arrUrl, { headers: { Authorization: `Basic ${basic}` } }),
  ]);
  let depRows: any[] = [];
  let arrRows: any[] = [];
  try {
    const depJ = depRes.ok ? await depRes.json() : [];
    depRows = Array.isArray(depJ) ? depJ : [];
  } catch {
    depRows = [];
  }
  try {
    const arrJ = arrRes.ok ? await arrRes.json() : [];
    arrRows = Array.isArray(arrJ) ? arrJ : [];
  } catch {
    arrRows = [];
  }
  return { depRows, arrRows, httpDep: depRes.status, httpArr: arrRes.status };
}

function openSkyRowToFlightRaw(row: Record<string, unknown>, role: "departure" | "arrival"): any | null {
  const icao24 = String(row.icao24 ?? "");
  const firstSeen = Number(row.firstSeen);
  const lastSeen = Number(row.lastSeen);
  const callsign = row.callsign != null ? String(row.callsign).trim() : null;
  const depIcao = row.estDepartureAirport != null ? String(row.estDepartureAirport).toUpperCase() : "";
  const arrIcao = row.estArrivalAirport != null ? String(row.estArrivalAirport).toUpperCase() : "";
  if (!icao24 || !Number.isFinite(firstSeen) || !Number.isFinite(lastSeen)) return null;

  const origin = icaoToIata(depIcao);
  const destination = icaoToIata(arrIcao);
  const depIso = new Date(firstSeen * 1000).toISOString();
  const arrIso = new Date(lastSeen * 1000).toISOString();
  const fn = callsign ? callsign.replace(/\s+/g, "").toUpperCase() : `OSK${icao24.slice(-4)}`;
  const carrier = fn.length >= 2 ? fn.slice(0, 2) : "OS";
  const id = `osm-${icao24}-${firstSeen}-${role}`;

  const depInfo = getAirportInfo(origin);
  const arrInfo = getAirportInfo(destination);

  return {
    id,
    flightNumber: fn,
    carrierCode: carrier,
    origin,
    destination,
    departure: {
      scheduled: utcHHMMFromUnix(firstSeen),
      actual: null,
      terminal: null,
      gate: null,
      scheduledISO: depIso,
      actualISO: null,
    },
    arrival: {
      scheduled: utcHHMMFromUnix(lastSeen),
      actual: null,
      terminal: null,
      gate: null,
      scheduledISO: arrIso,
      actualISO: null,
    },
    aircraftCode: null,
    callsign: callsign ?? fn,
    icao24,
    delayMinutes: null,
    presentationTimeISO: null,
    airportInfo: {
      departure: depInfo
        ? {
            name: depInfo.name,
            city: depInfo.city,
            country: depInfo.country,
            timezone: depInfo.timezone,
            iata: depInfo.iata ?? origin,
          }
        : null,
      arrival: arrInfo
        ? {
            name: arrInfo.name,
            city: arrInfo.city,
            country: arrInfo.country,
            timezone: arrInfo.timezone,
            iata: arrInfo.iata ?? destination,
          }
        : null,
    },
    tracking: null,
    status: "UPCOMING",
    recordSource: "opensky_airport_base",
  };
}

function computeTrackingPriority(
  flight: any,
  nowMs: number,
  isNextFlight: boolean
): { level: "none" | "low" | "moderate" | "high" | "max"; shouldTrack: boolean; ttlMs: number | null; reason: string } {
  const depMs = flight.departure?.scheduledISO ? new Date(flight.departure.scheduledISO).getTime() : null;
  const arrMs = flight.arrival?.scheduledISO ? new Date(flight.arrival.scheduledISO).getTime() : null;
  const briefingMs = flight.presentationTimeISO ? new Date(flight.presentationTimeISO).getTime() : null;

  if (arrMs && nowMs > arrMs + 30 * 60 * 1000) {
    return { level: "none", shouldTrack: false, ttlMs: null, reason: "completed" };
  }

  if (flight.tracking?.onGround === false) {
    return { level: "high", shouldTrack: true, ttlMs: TRACKING_TTL_MS_HIGH, reason: "airborne" };
  }

  if (isNextFlight) {
    return { level: "max", shouldTrack: true, ttlMs: TRACKING_TTL_MS_HIGH, reason: "next_flight" };
  }

  if (depMs && arrMs && nowMs >= depMs && nowMs <= arrMs + 15 * 60 * 1000) {
    return { level: "high", shouldTrack: true, ttlMs: TRACKING_TTL_MS_HIGH, reason: "in_progress_window" };
  }

  if (briefingMs && depMs && nowMs >= briefingMs && nowMs < depMs) {
    return { level: "high", shouldTrack: true, ttlMs: TRACKING_TTL_MS_HIGH, reason: "briefing_window" };
  }

  if (depMs) {
    const diff = depMs - nowMs;
    if (diff <= 0) {
      return { level: "moderate", shouldTrack: true, ttlMs: TRACKING_TTL_MS_MEDIUM, reason: "departure_passed_no_arrival_yet" };
    }
    if (diff <= 3 * 60 * 60 * 1000) {
      return { level: "high", shouldTrack: true, ttlMs: TRACKING_TTL_MS_HIGH, reason: "up_to_3h" };
    }
    if (diff <= 6 * 60 * 60 * 1000) {
      return { level: "moderate", shouldTrack: true, ttlMs: TRACKING_TTL_MS_MEDIUM, reason: "up_to_6h" };
    }
  }

  return { level: "none", shouldTrack: false, ttlMs: null, reason: "distant_or_irrelevant" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const cfg = readBackendConfig();
    console.log("[flight-status] request received");
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(cfg.supabaseUrl, cfg.supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Falha de autenticação" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    const url = new URL(req.url);
    const airportCode = (url.searchParams.get("airportCode") || "").toUpperCase();
    const carrierCode = (url.searchParams.get("carrierCode") || "").toUpperCase();
    const flightNumber = (url.searchParams.get("flightNumber") || "").trim();
    const scheduledDepartureDate = url.searchParams.get("scheduledDepartureDate") || getTodayDate();
    const boardMode = (url.searchParams.get("boardMode") || "my_schedule").toLowerCase();

    console.log("[flight-status] request received", {
      boardMode,
      airportCode: airportCode || "(vazio)",
      date: scheduledDepartureDate,
      carrierCode: carrierCode || "(vazio)",
      flightNumber: flightNumber || "(vazio)",
      userIdLen: userId?.length ?? 0,
      payload: { boardMode, airportCode, scheduledDepartureDate, carrierCode, flightNumber },
    });

    const now = Date.now();

    /** Base operacional: não usa schedule_entries — OpenSky flights by airport (ICAO) */
    if (boardMode === "airport_base") {
      const abKey = `ab|${userId}|${airportCode}|${carrierCode}|${flightNumber}|${scheduledDepartureDate}`;
      const abCached = airportBaseCache.get(abKey);
      if (abCached && now < abCached.expiresAt) {
        return new Response(JSON.stringify(abCached.data), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const icao = airportCode ? iataToIcao(airportCode) : null;
      if (!icao) {
        const payload = {
          ok: true,
          source: "opensky_airport_base",
          mode: "airport_base",
          boardMode: "airport_base",
          count: 0,
          flights: [],
          lastUpdatedAt: new Date().toISOString(),
          airportBaseReason: "unknown_airport_iata",
        };
        airportBaseCache.set(abKey, { expiresAt: now + AIRPORT_BASE_CACHE_TTL_MS, data: payload });
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const begin = Math.floor(new Date(`${scheduledDepartureDate}T00:00:00.000Z`).getTime() / 1000);
      const end = begin + 86400 - 1;
      console.log("[flight-status] airport_base OpenSky window", { icao, begin, end, date: scheduledDepartureDate });

      const { depRows, arrRows, httpDep, httpArr } = await fetchOpenSkyAirportDayFlights(cfg, icao, begin, end);

      if (!cfg.openSkyClientId || !cfg.openSkyClientSecret) {
        const payload = {
          ok: true,
          source: "opensky_airport_base",
          mode: "airport_base",
          boardMode: "airport_base",
          count: 0,
          flights: [],
          lastUpdatedAt: new Date().toISOString(),
          airportBaseReason: "opensky_credentials_required",
        };
        airportBaseCache.set(abKey, { expiresAt: now + AIRPORT_BASE_CACHE_TTL_MS, data: payload });
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const seen = new Set<string>();
      let flights: any[] = [];
      for (const row of depRows) {
        if (typeof row !== "object" || !row) continue;
        const fr = openSkyRowToFlightRaw(row as Record<string, unknown>, "departure");
        if (fr && !seen.has(fr.id)) {
          seen.add(fr.id);
          flights.push(fr);
        }
      }
      for (const row of arrRows) {
        if (typeof row !== "object" || !row) continue;
        const fr = openSkyRowToFlightRaw(row as Record<string, unknown>, "arrival");
        if (fr && !seen.has(fr.id)) {
          seen.add(fr.id);
          flights.push(fr);
        }
      }

      const upperAp = airportCode.toUpperCase();
      flights = flights.filter((f: any) => f.origin === upperAp || f.destination === upperAp);

      if (carrierCode) {
        flights = flights.filter((f: any) => String(f.carrierCode || "").toUpperCase().startsWith(carrierCode));
      }
      if (flightNumber) {
        const q = flightNumber.toUpperCase();
        flights = flights.filter((f: any) => String(f.flightNumber || "").toUpperCase().includes(q));
      }

      console.log("[flight-status] airport_base flights built", {
        rawDep: depRows.length,
        rawArr: arrRows.length,
        afterFilter: flights.length,
        httpDep,
        httpArr,
      });

      const sortedUpcoming = [...flights]
        .filter((f: any) => f.departure?.scheduledISO)
        .sort((a: any, b: any) => new Date(a.departure.scheduledISO).getTime() - new Date(b.departure.scheduledISO).getTime());
      const nextFlightId = sortedUpcoming.find((f: any) => new Date(f.departure.scheduledISO).getTime() > now)?.id ?? null;

      const trackingPlan = flights.map((f: any) => ({
        id: f.id,
        cacheKey: buildTrackingCacheKey(f),
        ...computeTrackingPriority(f, now, nextFlightId === f.id),
      }));

      const relevantPlan = trackingPlan.filter((p: any) => p.shouldTrack);
      const misses: any[] = [];

      for (const plan of relevantPlan) {
        const cachedTracking = trackingCache.get(plan.cacheKey);
        if (cachedTracking && now < cachedTracking.expiresAt) {
          flights = flights.map((f: any) => (f.id === plan.id ? { ...f, tracking: cachedTracking.tracking } : f));
        } else {
          misses.push(plan);
        }
      }

      if (misses.length > 0) {
        const states = await fetchOpenSkyStates(cfg);
        if (states.length > 0) {
          for (const miss of misses) {
            const flight = flights.find((f: any) => f.id === miss.id);
            if (!flight) continue;
            const match = matchTracking(flight, states);
            const normalizedTracking = match
              ? {
                  latitude: match.latitude,
                  longitude: match.longitude,
                  altitude: match.altitude,
                  velocity: match.velocity,
                  heading: match.heading,
                  onGround: match.onGround,
                  callsign: match.callsign,
                  icao24: match.icao24,
                  lastContact: match.lastContact,
                }
              : null;

            trackingCache.set(miss.cacheKey, {
              expiresAt: now + (miss.ttlMs ?? TRACKING_TTL_MS_MEDIUM),
              tracking: normalizedTracking,
            });

            flights = flights.map((f: any) =>
              f.id === miss.id
                ? {
                    ...f,
                    icao24: normalizedTracking?.icao24 ?? f.icao24 ?? null,
                    callsign: normalizedTracking?.callsign ?? f.callsign,
                    tracking: normalizedTracking,
                  }
                : f
            );
          }
        } else {
          for (const miss of misses) {
            trackingCache.set(miss.cacheKey, {
              expiresAt: now + (miss.ttlMs ?? TRACKING_TTL_MS_MEDIUM),
              tracking: null,
            });
          }
        }
      }

      flights = flights.map((f: any) => ({
        ...f,
        status: calculateInternalStatus(f, now, nextFlightId === f.id),
      }));

      const openSkyMatchCount = flights.filter((f: any) => f.tracking != null && f.tracking.latitude != null).length;

      console.log("[flight-status] airport_base response", {
        boardMode: "airport_base",
        icao,
        date: scheduledDepartureDate,
        rawDep: depRows.length,
        rawArr: arrRows.length,
        flightCount: flights.length,
        openSkyMatchCount,
        reasonZeroResults: flights.length === 0
          ? (depRows.length + arrRows.length === 0 ? "opensky_empty_for_window" : "filtered_out_or_no_match")
          : null,
      });

      const payload = {
        ok: true,
        source: "opensky_airport_base",
        mode: "airport_base",
        boardMode: "airport_base",
        count: flights.length,
        flights,
        lastUpdatedAt: new Date().toISOString(),
        airportBaseMeta: {
          httpDep,
          httpArr,
          openskyCredentials: true,
          openSkyMatchCount,
          rawDepCount: depRows.length,
          rawArrCount: arrRows.length,
          reasonZeroResults:
            flights.length === 0
              ? depRows.length + arrRows.length === 0
                ? "opensky_empty_for_window"
                : "filtered_out_or_no_match"
              : null,
        },
      };

      airportBaseCache.set(abKey, { expiresAt: now + AIRPORT_BASE_CACHE_TTL_MS, data: payload });
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cacheKey = `${userId}|my_schedule|${airportCode}|${carrierCode}|${flightNumber}|${scheduledDepartureDate}`;
    const cached = rosterCache.get(cacheKey);
    if (cached && now < cached.expiresAt) {
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: activeRosters } = await supabase
      .from("imported_rosters")
      .select("id, created_at, import_origin, portal_connection_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(5);

    const portalFirst = (r: { import_origin?: string | null; portal_connection_id?: string | null }) => {
      if (r.import_origin === "portal") return 0;
      if (r.portal_connection_id) return 0;
      return 1;
    };

    const activeRoster = (activeRosters ?? []).sort((a: any, b: any) => portalFirst(a) - portalFirst(b))[0];

    if (!activeRoster?.id) {
      console.log("[flight-status] active roster not found", { userId });
      const payload = { ok: true, source: "roster+local+opensky", mode: "airport", count: 0, flights: [], lastUpdatedAt: new Date().toISOString() };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[flight-status] active roster found", { userId, rosterId: activeRoster.id });

    let query = supabase
      .from("schedule_entries")
      .select("*")
      .eq("user_id", userId)
      .eq("roster_id", activeRoster.id)
      .eq("is_flight", true)
      .eq("date", scheduledDepartureDate)
      .order("sort_datetime", { ascending: true, nullsFirst: false });

    if (carrierCode) query = query.ilike("flight_number", `${carrierCode}%`);
    if (flightNumber) query = query.ilike("flight_number", `%${flightNumber}%`);

    const { data: rows, error: rowsError } = await query;
    if (rowsError) {
      return new Response(JSON.stringify({ error: rowsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[flight-status] roster flights extracted", { count: (rows ?? []).length, date: scheduledDepartureDate });

    let flights = (rows ?? []).map((row: any) => {
      const depCode = (row.departure_airport || row.departure || "-").toUpperCase();
      const arrCode = (row.arrival_airport || row.arrival || "-").toUpperCase();
      const depISO = toIso(row.date, row.departure_time);
      const arrISO = toIso(row.date, row.arrival_time);
      const presentationISO = toIso(row.date, row.report_time);

      return {
        id: String(row.id),
        flightNumber: row.flight_number || "-",
        carrierCode: (row.airline || row.flight_number?.slice(0, 2) || "-").toUpperCase(),
        origin: depCode,
        destination: arrCode,
        departure: {
          scheduled: row.departure_time ?? null,
          actual: null,
          terminal: null,
          gate: null,
          scheduledISO: depISO,
          actualISO: null,
        },
        arrival: {
          scheduled: row.arrival_time ?? null,
          actual: null,
          terminal: null,
          gate: null,
          scheduledISO: arrISO,
          actualISO: null,
        },
        aircraftCode: row.aircraft_type ?? null,
        callsign: row.flight_number ?? null,
        icao24: null,
        delayMinutes: null,
        presentationTimeISO: presentationISO,
        airportInfo: {
          departure: getAirportInfo(depCode),
          arrival: getAirportInfo(arrCode),
        },
        tracking: null,
        status: "UPCOMING",
        recordSource: "schedule_edge",
      };
    });

    if (airportCode) {
      flights = flights.filter((f: any) => f.origin === airportCode || f.destination === airportCode);
    }
    console.log("[flight-status] local enrichment applied", { count: flights.length, airportFilter: airportCode || null });

    const sortedUpcoming = [...flights]
      .filter((f: any) => f.departure?.scheduledISO)
      .sort((a: any, b: any) => new Date(a.departure.scheduledISO).getTime() - new Date(b.departure.scheduledISO).getTime());
    const nextFlightId = sortedUpcoming.find((f: any) => new Date(f.departure.scheduledISO).getTime() > now)?.id ?? null;

    const trackingPlan = flights.map((f: any) => ({
      id: f.id,
      cacheKey: buildTrackingCacheKey(f),
      ...computeTrackingPriority(f, now, nextFlightId === f.id),
    }));

    const relevantPlan = trackingPlan.filter((p: any) => p.shouldTrack);
    const misses: any[] = [];

    for (const plan of relevantPlan) {
      const cachedTracking = trackingCache.get(plan.cacheKey);
      if (cachedTracking && now < cachedTracking.expiresAt) {
        console.log("[flight-status] tracking cache hit", { key: plan.cacheKey, level: plan.level, reason: plan.reason });
        flights = flights.map((f: any) => (f.id === plan.id ? { ...f, tracking: cachedTracking.tracking } : f));
      } else {
        console.log("[flight-status] tracking cache miss", { key: plan.cacheKey, level: plan.level, reason: plan.reason });
        misses.push(plan);
      }
    }

    if (trackingPlan.some((p: any) => !p.shouldTrack)) {
      console.log("[flight-status] tracking skipped by relevance", {
        skipped: trackingPlan.filter((p: any) => !p.shouldTrack).length,
        total: trackingPlan.length,
      });
    }

    if (misses.length > 0) {
      console.log("[flight-status] OpenSky call started", { misses: misses.length });
      const states = await fetchOpenSkyStates(cfg);
      if (states.length > 0) {
        console.log("[flight-status] OpenSky returned states", { count: states.length });
        for (const miss of misses) {
          const flight = flights.find((f: any) => f.id === miss.id);
          if (!flight) continue;
          const match = matchTracking(flight, states);
          const normalizedTracking = match
            ? {
                latitude: match.latitude,
                longitude: match.longitude,
                altitude: match.altitude,
                velocity: match.velocity,
                heading: match.heading,
                onGround: match.onGround,
                callsign: match.callsign,
                icao24: match.icao24,
                lastContact: match.lastContact,
              }
            : null;

          trackingCache.set(miss.cacheKey, {
            expiresAt: now + (miss.ttlMs ?? TRACKING_TTL_MS_MEDIUM),
            tracking: normalizedTracking,
          });

          flights = flights.map((f: any) =>
            f.id === miss.id
              ? {
                  ...f,
                  icao24: normalizedTracking?.icao24 ?? f.icao24 ?? null,
                  callsign: normalizedTracking?.callsign ?? f.callsign,
                  tracking: normalizedTracking,
                }
              : f
          );
        }
        console.log("[flight-status] OpenSky tracking merged", {
          trackedFlights: flights.filter((f: any) => !!f.tracking).length,
          totalFlights: flights.length,
        });
      } else {
        console.warn("[flight-status] OpenSky returned no data; tracking kept null");
        for (const miss of misses) {
          trackingCache.set(miss.cacheKey, {
            expiresAt: now + (miss.ttlMs ?? TRACKING_TTL_MS_MEDIUM),
            tracking: null,
          });
        }
      }
    }

    flights = flights.map((f: any) => ({
      ...f,
      status: calculateInternalStatus(f, now, nextFlightId === f.id),
    }));

    const openSkyMatchCount = flights.filter((f: any) => f.tracking != null && f.tracking.latitude != null).length;
    const payload = {
      ok: true,
      source: "roster+local+opensky",
      mode: "airport",
      count: flights.length,
      flights,
      lastUpdatedAt: new Date().toISOString(),
      diagnostic: {
        openSkyMatchCount,
        rosterFlights: (rows ?? []).length,
        fallbackReason: flights.length === 0 ? "no_roster_or_no_entries_for_date" : (openSkyMatchCount === 0 ? "no_opensky_match" : null),
      },
    };

    console.log("[flight-status] my_schedule response", {
      boardMode: "my_schedule",
      flightCount: flights.length,
      openSkyMatchCount,
      rosterFlights: (rows ?? []).length,
      fallbackReason: (payload.diagnostic as Record<string, unknown>)?.fallbackReason ?? null,
    });

    rosterCache.set(cacheKey, { expiresAt: now + ROSTER_TTL_MS, data: payload });

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[flight-status] pipeline failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return new Response(
      JSON.stringify({
        error: "Erro ao consultar voo",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
