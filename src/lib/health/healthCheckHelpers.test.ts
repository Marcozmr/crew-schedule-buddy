import { describe, expect, it, vi } from "vitest";
import {
  aggregateOverallStatus,
  emptyHealthReport,
  failureStatusForCheck,
  fetchWithTimeout,
  isReachableHttpStatus,
  retry,
  showSystemHealthIndicator,
} from "./healthCheckHelpers";

describe("isReachableHttpStatus", () => {
  it("aceita 2xx, 404 e 406", () => {
    expect(isReachableHttpStatus(200)).toBe(true);
    expect(isReachableHttpStatus(404)).toBe(true);
    expect(isReachableHttpStatus(406)).toBe(true);
    expect(isReachableHttpStatus(500)).toBe(false);
  });
});

describe("failureStatusForCheck", () => {
  it("marca supabase e auth como down", () => {
    expect(failureStatusForCheck("supabase_connection")).toBe("down");
    expect(failureStatusForCheck("auth_service")).toBe("down");
  });

  it("marca edge e flight como degraded", () => {
    expect(failureStatusForCheck("edge_functions")).toBe("degraded");
    expect(failureStatusForCheck("flight_data_provider")).toBe("degraded");
  });
});

describe("aggregateOverallStatus", () => {
  it("down se qualquer check down", () => {
    expect(
      aggregateOverallStatus([
        { id: "supabase_connection", status: "down" },
        { id: "auth_service", status: "healthy" },
        { id: "edge_functions", status: "healthy" },
        { id: "flight_data_provider", status: "healthy" },
      ]),
    ).toBe("down");
  });

  it("degraded se nenhum down mas há degraded", () => {
    expect(
      aggregateOverallStatus([
        { id: "supabase_connection", status: "healthy" },
        { id: "auth_service", status: "healthy" },
        { id: "edge_functions", status: "degraded" },
        { id: "flight_data_provider", status: "healthy" },
      ]),
    ).toBe("degraded");
  });

  it("healthy se todos ok", () => {
    expect(
      aggregateOverallStatus([
        { id: "supabase_connection", status: "healthy" },
        { id: "auth_service", status: "healthy" },
        { id: "edge_functions", status: "healthy" },
        { id: "flight_data_provider", status: "healthy" },
      ]),
    ).toBe("healthy");
  });
});

describe("retry", () => {
  it("retorna na primeira sucesso", async () => {
    let n = 0;
    const v = await retry(
      async () => {
        n++;
        return 42;
      },
      3,
      1,
    );
    expect(v).toBe(42);
    expect(n).toBe(1);
  });

  it("repete até esgotar tentativas", async () => {
    let n = 0;
    await expect(
      retry(
        async () => {
          n++;
          throw new Error("fail");
        },
        3,
        1,
      ),
    ).rejects.toThrow("fail");
    expect(n).toBe(3);
  });

  it("recupera na segunda tentativa", async () => {
    let n = 0;
    const v = await retry(
      async () => {
        n++;
        if (n < 2) throw new Error("transient");
        return "ok";
      },
      3,
      1,
    );
    expect(v).toBe("ok");
    expect(n).toBe(2);
  });
});

describe("fetchWithTimeout", () => {
  it("aborta após timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            reject(new Error("expected AbortSignal"));
            return;
          }
          const onAbort = () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          };
          if (signal.aborted) {
            onAbort();
            return;
          }
          signal.addEventListener("abort", onAbort, { once: true });
        });
      }),
    );
    await expect(fetchWithTimeout("https://example.com", {}, 30)).rejects.toMatchObject({
      name: "AbortError",
    });
    vi.unstubAllGlobals();
  });
});

describe("emptyHealthReport", () => {
  it("preenche os quatro ids", () => {
    const r = emptyHealthReport("x");
    expect(r.overall).toBe("degraded");
    expect(r.checks).toHaveLength(4);
    expect(r.checks.every((c) => c.detail === "x")).toBe(true);
  });
});

describe("showSystemHealthIndicator", () => {
  it("exporta função", () => {
    expect(typeof showSystemHealthIndicator).toBe("function");
  });
});
