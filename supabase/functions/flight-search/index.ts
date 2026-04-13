/**
 * Busca livre de voos (Pro Board) — cache Postgres + rate limit + OpenSky (provider isolado).
 * Cache hit: não consome quota diária nem chama OpenSky.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runFlightSearch, type SearchPayload } from "./engine.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

const CACHE_TTL_MIN = 12;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePayload(raw: Record<string, unknown>): SearchPayload | null {
  const mode = String(raw.mode ?? "").toLowerCase();
  const direction = String(raw.direction ?? "departure").toLowerCase();
  if (mode !== "flight" && mode !== "airport") return null;
  if (direction !== "departure" && direction !== "arrival") return null;
  const date = String(raw.date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return {
    mode: mode as "flight" | "airport",
    direction: direction as "departure" | "arrival",
    airport: raw.airport != null ? String(raw.airport).trim().toUpperCase() : undefined,
    date,
    airline: raw.airline != null ? String(raw.airline).trim() : undefined,
    flightNumber: raw.flightNumber != null ? String(raw.flightNumber).trim() : undefined,
  };
}

function cacheKey(p: SearchPayload): string {
  return [
    "fs",
    "v1",
    p.mode,
    p.direction,
    (p.airport ?? "").toUpperCase(),
    p.date,
    (p.airline ?? "").toUpperCase(),
    (p.flightNumber ?? "").replace(/\D/g, ""),
  ].join("|");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, status: "error", error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, status: "error", error: "server_misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!jwt) {
    return json({ ok: false, status: "error", error: "unauthorized" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !authData?.user?.id) {
    return json({ ok: false, status: "error", error: "unauthorized" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, status: "error", error: "invalid_json" }, 400);
  }

  const payload = normalizePayload(body);
  if (!payload) {
    return json({ ok: false, status: "error", error: "invalid_payload" }, 400);
  }

  const dailyLimit = Number(Deno.env.get("FLIGHT_SEARCH_DAILY_LIMIT") ?? "10") || 10;
  const key = cacheKey(payload);

  const { data: cachedRows, error: cacheReadErr } = await supabase
    .from("flights_cache")
    .select("response_json, updated_at")
    .eq("cache_key", key)
    .maybeSingle();

  if (cacheReadErr) {
    console.log(JSON.stringify({ event: "flight_search_cache_read_error" }));
  } else if (cachedRows?.updated_at) {
    const updated = new Date(cachedRows.updated_at as string).getTime();
    if (Date.now() - updated < CACHE_TTL_MIN * 60 * 1000) {
      const parsed = cachedRows.response_json as {
        source?: string;
        hint?: string;
        data?: unknown;
      };
      console.log(JSON.stringify({ event: "flight_search_cache_hit", cache_key_prefix: key.slice(0, 40) }));
      return json({
        ok: true,
        status: "ok",
        source: String(parsed.source ?? "opensky"),
        cached: true,
        quotaConsumed: false,
        hint: parsed.hint,
        data: parsed.data ?? [],
      });
    }
  }

  const { data: rateData, error: rateErr } = await supabase.rpc("flight_search_try_increment", {
    p_user_id: authData.user.id,
    p_daily_limit: dailyLimit,
  });

  if (rateErr) {
    console.log(JSON.stringify({ event: "flight_search_rate_error", detail: rateErr.message?.slice(0, 120) }));
    return json({ ok: false, status: "error", error: "rate_check_failed" }, 500);
  }

  const rate = rateData as { allowed?: boolean; remaining?: number; limit?: number; count?: number } | null;
  if (!rate?.allowed) {
    return json(
      {
        ok: false,
        status: "error",
        error: "rate_limited",
        message:
          "No momento não é possível fazer mais pesquisas. Tente novamente mais tarde.",
        rate: {
          limit: rate?.limit ?? dailyLimit,
          count: rate?.count ?? dailyLimit,
          remaining: 0,
        },
      },
      429,
    );
  }

  console.log(JSON.stringify({ event: "flight_search_cache_miss", mode: payload.mode }));

  const result = await runFlightSearch(payload);
  console.log(
    JSON.stringify({
      event: "flight_search_engine_result",
      mode: payload.mode,
      item_count: result.items.length,
      hint: result.hint ?? null,
    }),
  );

  const toCache = {
    ok: true,
    source: result.source,
    hint: result.hint,
    data: result.items,
  };

  const responseBody: Record<string, unknown> = {
    ok: true,
    status: "ok",
    source: result.source,
    cached: false,
    quotaConsumed: true,
    hint: result.hint,
    rate: {
      limit: rate.limit ?? dailyLimit,
      count: rate.count ?? 0,
      remaining: rate.remaining ?? 0,
    },
    data: result.items,
  };

  const { error: upsertErr } = await supabase.from("flights_cache").upsert(
    {
      cache_key: key,
      mode: payload.mode,
      airport: payload.airport ?? null,
      direction: payload.direction,
      airline: payload.airline ?? null,
      flight_number: payload.flightNumber ?? null,
      flight_date: payload.date,
      response_json: toCache,
      source: result.source,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "cache_key" },
  );

  if (upsertErr) {
    console.log(JSON.stringify({ event: "flight_search_cache_write_error", detail: upsertErr.message?.slice(0, 120) }));
  }

  return json(responseBody);
});
