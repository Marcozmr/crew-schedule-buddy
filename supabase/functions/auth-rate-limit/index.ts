/**
 * Valida rate limit de auth antes de o cliente chamar supabase.auth.*.
 * Usa service_role + RPC `auth_rate_limit_check` (sem exposição a anon).
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (automáticos no runtime).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, accept, origin, referer",
};

const ACTIONS = new Set([
  "signup",
  "login",
  "forgot_password",
  "resend_confirmation",
]);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf.slice(0, 128);
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 128);
  return "unknown";
}

function normalizeEmail(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  if (t.length > 320) return null;
  return t;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    return json({ ok: false, error: "server_error" }, 500);
  }

  let body: { action?: string; email?: string | null };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const action = typeof body.action === "string" ? body.action.trim() : "";
  if (!ACTIONS.has(action)) {
    return json({ ok: false, error: "invalid_action" }, 400);
  }

  const email = normalizeEmail(body.email);
  const needsEmail =
    action === "signup" ||
    action === "login" ||
    action === "forgot_password" ||
    action === "resend_confirmation";
  if (needsEmail && !email) {
    return json({ ok: false, error: "email_required" }, 400);
  }

  const ip = clientIp(req);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("auth_rate_limit_check", {
    p_action: action,
    p_ip: ip,
    p_email: email,
  });

  if (error) {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        fn: "auth-rate-limit",
        rpc_error: error.message,
        code: error.code,
      }),
    );
    return json({ ok: false, error: "server_error" }, 500);
  }

  const row = data as { allowed?: boolean; reason?: string } | null;
  if (!row || typeof row.allowed !== "boolean") {
    return json({ ok: false, error: "server_error" }, 500);
  }

  if (!row.allowed) {
    if (row.reason === "rate_limit") {
      return json({ ok: false, error: "rate_limit" }, 429);
    }
    return json({ ok: false, error: "not_allowed" }, 400);
  }

  return json({ ok: true });
});
