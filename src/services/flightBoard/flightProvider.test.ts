import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: "token-de-teste" } } }),
    },
    functions: { invoke },
  },
}));

describe("fetchFlightStatusEnrichment", () => {
  beforeEach(() => {
    vi.resetModules();
    invoke.mockReset();
    vi.stubEnv("VITE_SUPABASE_URL", "https://exemplo.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "chave-publica");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("devolve os voos quando a Edge Function responde com sucesso", async () => {
    invoke.mockResolvedValue({
      data: { flights: [{ flightNumber: "LA3000" }, { flightNumber: "LA3001" }] },
      error: null,
      response: new Response(null, { status: 200 }),
    });

    const { fetchFlightStatusEnrichment } = await import("./flightProvider");
    const result = await fetchFlightStatusEnrichment({
      airportCode: "GRU",
      date: "2026-11-04",
      boardMode: "my_schedule",
    });

    expect(result.flights).toHaveLength(2);
    expect(result.meta.reason).toBe("ok");
    expect(result.meta.httpStatus).toBe(200);
    expect(result.meta.serverError).toBeUndefined();
  });

  it("não quebra quando o cliente não informa o response", async () => {
    invoke.mockResolvedValue({ data: { flights: [{ flightNumber: "LA3000" }] }, error: null });

    const { fetchFlightStatusEnrichment } = await import("./flightProvider");
    const result = await fetchFlightStatusEnrichment({
      airportCode: "CGH",
      date: "2026-11-04",
      boardMode: "my_schedule",
    });

    expect(result.flights).toHaveLength(1);
    expect(result.meta.reason).toBe("ok");
  });
});
