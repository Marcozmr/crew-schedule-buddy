/**
 * Segundo caminho do keep-alive: Vercel Cron → consulta real no Postgres.
 *
 * Existe para não depender só do GitHub Actions, que desliga agendamentos após 60 dias
 * sem atividade em repositórios públicos. Usa a chave pública que já está na Vercel,
 * então não exige segredo novo. CRON_SECRET é opcional: a resposta não expõe dados.
 */

const TIMEOUT_MS = 20_000;

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return json({ ok: false, status: "error", error: "unauthorized" }, 401);
  }

  const url = process.env.VITE_SUPABASE_URL?.trim();
  const key =
    process.env.VITE_SUPABASE_ANON_KEY?.trim() || process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) {
    console.error(JSON.stringify({ event: "keep_alive_misconfigured" }));
    return json({ ok: false, status: "error", error: "missing_supabase_env" }, 500);
  }

  try {
    const res = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(JSON.stringify({ event: "keep_alive_db_failed", httpStatus: res.status }));
      return json({ ok: false, status: "error", error: "db_ping_failed", httpStatus: res.status }, 502);
    }
    console.log(JSON.stringify({ event: "keep_alive_ping_ok" }));
    return json({ ok: true, status: "ok" });
  } catch {
    console.error(JSON.stringify({ event: "keep_alive_db_unreachable" }));
    return json({ ok: false, status: "error", error: "db_unreachable" }, 502);
  }
}
