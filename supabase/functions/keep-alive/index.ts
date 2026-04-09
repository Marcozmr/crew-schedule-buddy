/**
 * Keep-alive leve para projetos Supabase Free (atividade mínima).
 *
 * Atividade: invocação da Edge Function + RPC `keep_alive_ping` (Postgres `SELECT now()`).
 * Isto gera tráfego real no projeto (API + DB), além do tráfego HTTP de entrada.
 *
 * Secrets (Dashboard → Edge Functions → Secrets):
 *   KEEP_ALIVE_SECRET — obrigatório; o cliente envia o mesmo valor no header `x-keep-alive-secret`.
 * Runtime automático: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Headers": "authorization, content-type, x-keep-alive-secret, x-client-info",
};

/** Evita respostas servidas de cache intermedário (POST já não costuma cachear; reforço explícito). */
const noCacheHeaders: Record<string, string> = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...noCacheHeaders,
      "Content-Type": "application/json",
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { ...corsHeaders, ...noCacheHeaders },
    });
  }

  if (req.method !== "POST") {
    return json({ ok: false, status: "error", error: "method_not_allowed" }, 405);
  }

  const configured = Deno.env.get("KEEP_ALIVE_SECRET")?.trim();
  const provided = req.headers.get("x-keep-alive-secret")?.trim();

  if (!configured) {
    console.log(JSON.stringify({ event: "keep_alive_misconfigured", reason: "secret_not_set" }));
    return json({ ok: false, status: "error", error: "secret_not_configured" }, 503);
  }

  if (!provided || provided !== configured) {
    console.log(JSON.stringify({ event: "keep_alive_auth_failed" }));
    return json({ ok: false, status: "error", error: "unauthorized" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!url || !serviceKey) {
    console.log(JSON.stringify({ event: "keep_alive_misconfigured", reason: "missing_runtime_env" }));
    return json({ ok: false, status: "error", error: "server_misconfigured" }, 500);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("keep_alive_ping");

  if (error) {
    const detail = String(error.message ?? error).slice(0, 160);
    console.log(JSON.stringify({ event: "keep_alive_db_failed", code: error.code ?? "unknown" }));
    return json(
      {
        ok: false,
        status: "error",
        error: "db_ping_failed",
        detail,
      },
      500,
    );
  }

  const timestamp =
    typeof data === "string"
      ? data
      : data instanceof Date
        ? data.toISOString()
        : new Date().toISOString();

  console.log(
    JSON.stringify({
      event: "keep_alive_ping_ok",
      timestamp,
    }),
  );

  return json({
    ok: true,
    status: "ok",
    timestamp,
    source: "keep-alive",
  });
});
