import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { runSystemHealthChecks } from "./healthCheckService";

vi.mock("@/lib/monitoring/errorReporting", () => ({
  reportOperationalEvent: vi.fn(),
}));

describe("runSystemHealthChecks", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubEnv("VITE_ROSTER_AUTOMATION_URL", "");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("retorna relatório degradado quando env Supabase ausente", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    const r = await runSystemHealthChecks();
    expect(r.checks.every((c) => c.detail === "missing_supabase_env")).toBe(true);
    expect(r.overall).toBe("degraded");
  });

  it("não lança quando fetch falha", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const r = await runSystemHealthChecks();
    expect(r.checks.length).toBe(4);
    expect(r.overall).toMatch(/down|degraded/);
  });

  it("overall healthy quando probes básicos respondem", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/rest/v1/")) return Promise.resolve(new Response(null, { status: 200 }));
        if (url.includes("/auth/v1/health")) return Promise.resolve(new Response(null, { status: 200 }));
        if (url.includes("/auth/v1/settings")) return Promise.resolve(new Response("{}", { status: 200 }));
        if (url.includes("/functions/v1/")) return Promise.resolve(new Response(null, { status: 200 }));
        return Promise.reject(new Error(`unexpected ${url}`));
      }),
    );

    const r = await runSystemHealthChecks();
    expect(r.overall).toBe("healthy");
    expect(r.checks.every((c) => c.status === "healthy")).toBe(true);
  });

  it("auth usa settings quando health não ok", async () => {
    let settingsHit = false;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/rest/v1/")) return Promise.resolve(new Response(null, { status: 200 }));
        if (url.includes("/auth/v1/health")) return Promise.resolve(new Response(null, { status: 404 }));
        if (url.includes("/auth/v1/settings")) {
          settingsHit = true;
          return Promise.resolve(new Response("{}", { status: 200 }));
        }
        if (url.includes("/functions/v1/")) return Promise.resolve(new Response(null, { status: 200 }));
        return Promise.reject(new Error(`unexpected ${url}`));
      }),
    );

    const r = await runSystemHealthChecks();
    expect(settingsHit).toBe(true);
    expect(r.checks.find((c) => c.id === "auth_service")?.status).toBe("healthy");
  });

  it("inclui roster_automation quando VITE_ROSTER_AUTOMATION_URL está definido e /health devolve ok", async () => {
    vi.stubEnv("VITE_ROSTER_AUTOMATION_URL", "http://localhost:8790");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/rest/v1/")) return Promise.resolve(new Response(null, { status: 200 }));
        if (url.includes("/auth/v1/health")) return Promise.resolve(new Response(null, { status: 200 }));
        if (url.includes("/auth/v1/settings")) return Promise.resolve(new Response("{}", { status: 200 }));
        if (url.includes("/functions/v1/")) return Promise.resolve(new Response(null, { status: 200 }));
        if (url.endsWith("/health") && url.includes("8790")) {
          return Promise.resolve(
            new Response(JSON.stringify({ ok: true }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        return Promise.reject(new Error(`unexpected ${url}`));
      }),
    );

    const r = await runSystemHealthChecks();
    expect(r.checks).toHaveLength(5);
    expect(r.checks.find((c) => c.id === "roster_automation")?.status).toBe("healthy");
    expect(r.overall).toBe("healthy");
  });
});
