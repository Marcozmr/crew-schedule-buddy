/**
 * cleanup-roster-history — retenção do histórico de escalas importadas (imported_rosters).
 *
 * Mantém pelo menos RETENTION_DAYS (default 90 ≈ 3 meses) de histórico por utilizador.
 * Depois disso, apaga automaticamente a versão importada (linha em `imported_rosters`),
 * os `schedule_entries` ligados a ela e o PDF correspondente no Storage.
 *
 * Nunca apaga:
 *  - a escala atualmente ATIVA do utilizador (is_active = true), não importa a idade;
 *  - a importação mais recente de cada utilizador (mesmo que nenhuma esteja marcada ativa —
 *    rede de segurança contra deixar o utilizador sem nenhum histórico).
 *
 * Secrets (Supabase → Edge Functions → Secrets):
 *   CLEANUP_ROSTER_HISTORY_SECRET — obrigatório; o cliente envia o mesmo valor no header
 *   `x-cleanup-secret`.
 *   ROSTER_HISTORY_RETENTION_DAYS — opcional (default 90).
 * Runtime automático: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Headers": "authorization, content-type, x-cleanup-secret, x-client-info",
};

const STORAGE_BUCKET = "crew-rosters";
const DEFAULT_RETENTION_DAYS = 90;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type CandidateRow = {
  id: string;
  user_id: string;
  storage_path: string | null;
  created_at: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const configured = Deno.env.get("CLEANUP_ROSTER_HISTORY_SECRET")?.trim();
  const provided = req.headers.get("x-cleanup-secret")?.trim();
  if (!configured) {
    console.log(JSON.stringify({ event: "cleanup_roster_history_misconfigured", reason: "secret_not_set" }));
    return json({ ok: false, error: "secret_not_configured" }, 503);
  }
  if (!provided || provided !== configured) {
    console.log(JSON.stringify({ event: "cleanup_roster_history_auth_failed" }));
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: "server_misconfigured" }, 500);
  }

  const retentionDays = Number(Deno.env.get("ROSTER_HISTORY_RETENTION_DAYS") ?? "") || DEFAULT_RETENTION_DAYS;
  const cutoffIso = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Candidatas: inativas e mais antigas que o corte. Nunca toca em is_active = true.
  const { data: candidates, error: fetchErr } = await supabase
    .from("imported_rosters")
    .select("id, user_id, storage_path, created_at")
    .eq("is_active", false)
    .lt("created_at", cutoffIso)
    .order("user_id", { ascending: true })
    .order("created_at", { ascending: false })
    .returns<CandidateRow[]>();

  if (fetchErr) {
    console.log(JSON.stringify({ event: "cleanup_roster_history_fetch_failed", detail: fetchErr.message?.slice(0, 200) }));
    return json({ ok: false, error: "fetch_failed" }, 500);
  }

  // Rede de segurança: nunca apagar a importação mais recente de cada utilizador dentro do
  // conjunto candidato (mesmo que nenhuma esteja marcada como ativa).
  const seenUser = new Set<string>();
  const toDelete: CandidateRow[] = [];
  for (const row of candidates ?? []) {
    if (seenUser.has(row.user_id)) {
      toDelete.push(row);
    } else {
      seenUser.add(row.user_id);
    }
  }

  if (toDelete.length === 0) {
    console.log(JSON.stringify({ event: "cleanup_roster_history_noop", retentionDays }));
    return json({ ok: true, status: "ok", retentionDays, deletedCount: 0 });
  }

  const ids = toDelete.map((r) => r.id);
  const storagePaths = toDelete.map((r) => r.storage_path).filter((p): p is string => !!p?.trim());

  // 1) schedule_entries ligados (a FK de roster_id nem sempre garante cascade — apaga explícito).
  const { error: entriesErr } = await supabase.from("schedule_entries").delete().in("roster_id", ids);
  if (entriesErr) {
    console.log(JSON.stringify({ event: "cleanup_roster_history_entries_failed", detail: entriesErr.message?.slice(0, 200) }));
    return json({ ok: false, error: "entries_delete_failed" }, 500);
  }

  // 2) PDFs no Storage (best-effort — não bloqueia a limpeza das linhas se falhar).
  if (storagePaths.length > 0) {
    const { error: storageErr } = await supabase.storage.from(STORAGE_BUCKET).remove(storagePaths);
    if (storageErr) {
      console.log(JSON.stringify({ event: "cleanup_roster_history_storage_failed", detail: storageErr.message?.slice(0, 200) }));
    }
  }

  // 3) linhas de imported_rosters.
  const { error: rostersErr } = await supabase.from("imported_rosters").delete().in("id", ids);
  if (rostersErr) {
    console.log(JSON.stringify({ event: "cleanup_roster_history_rosters_failed", detail: rostersErr.message?.slice(0, 200) }));
    return json({ ok: false, error: "rosters_delete_failed" }, 500);
  }

  console.log(
    JSON.stringify({
      event: "cleanup_roster_history_ok",
      retentionDays,
      deletedCount: ids.length,
      affectedUsers: seenUser.size,
    }),
  );

  return json({ ok: true, status: "ok", retentionDays, deletedCount: ids.length });
});
