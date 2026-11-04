// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../api/keep-alive";

const fetchMock = vi.fn();

function cronRequest(headers: Record<string, string> = {}) {
  return new Request("https://www.escalax.app.br/api/keep-alive", { headers });
}

describe("keep-alive pelo Vercel Cron", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VITE_SUPABASE_URL", "https://exemplo.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "chave-publica");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("CRON_SECRET", "");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("faz uma consulta real no banco e responde ok", async () => {
    fetchMock.mockResolvedValue(new Response("[]", { status: 200 }));

    const res = await GET(cronRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: "ok" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://exemplo.supabase.co/rest/v1/profiles?select=id&limit=1");
    expect(init.headers.apikey).toBe("chave-publica");
  });

  it("aceita a chave pelo nome alternativo", async () => {
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "chave-alternativa");
    fetchMock.mockResolvedValue(new Response("[]", { status: 200 }));

    expect((await GET(cronRequest())).status).toBe(200);
    expect(fetchMock.mock.calls[0][1].headers.apikey).toBe("chave-alternativa");
  });

  it("marca falha quando o banco não responde 200, para aparecer nos logs da Vercel", async () => {
    fetchMock.mockResolvedValue(new Response("pausado", { status: 503 }));

    const res = await GET(cronRequest());

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, status: "error", error: "db_ping_failed", httpStatus: 503 });
  });

  it("marca falha quando a rede cai", async () => {
    fetchMock.mockRejectedValue(new Error("timeout"));

    const res = await GET(cronRequest());

    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("db_unreachable");
  });

  it("recusa chamada sem o segredo quando CRON_SECRET existe", async () => {
    vi.stubEnv("CRON_SECRET", "segredo");

    const res = await GET(cronRequest());

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aceita o segredo enviado pelo Vercel Cron", async () => {
    vi.stubEnv("CRON_SECRET", "segredo");
    fetchMock.mockResolvedValue(new Response("[]", { status: 200 }));

    const res = await GET(cronRequest({ authorization: "Bearer segredo" }));

    expect(res.status).toBe(200);
  });

  it("avisa quando faltam as variáveis do Supabase", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");

    const res = await GET(cronRequest());

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("missing_supabase_env");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
