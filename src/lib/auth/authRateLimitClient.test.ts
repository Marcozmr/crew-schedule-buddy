import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AuthRateLimitError } from "./authRateLimitError";
import {
  assertAuthRateLimitAllowed,
  parseAuthRateLimitPayloadForTests,
} from "./authRateLimitClient";

describe("parseAuthRateLimitPayloadForTests", () => {
  it("ok quando 200 e ok true", () => {
    expect(parseAuthRateLimitPayloadForTests(200, { ok: true })).toBe("ok");
  });

  it("limit quando 429", () => {
    expect(parseAuthRateLimitPayloadForTests(429, { ok: false, error: "rate_limit" })).toBe("limit");
  });

  it("limit quando error rate_limit", () => {
    expect(parseAuthRateLimitPayloadForTests(400, { ok: false, error: "rate_limit" })).toBe("limit");
  });

  it("unexpected noutros casos", () => {
    expect(parseAuthRateLimitPayloadForTests(500, { ok: false })).toBe("unexpected");
  });
});

describe("assertAuthRateLimitAllowed", () => {
  const origFetch = globalThis.fetch;
  const origEnabled = import.meta.env.VITE_AUTH_RATE_LIMIT_ENABLED;
  const origFailOpen = import.meta.env.VITE_AUTH_RATE_LIMIT_FAIL_OPEN;
  const origUrl = import.meta.env.VITE_SUPABASE_URL;
  const origAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;

  beforeEach(() => {
    vi.stubEnv("VITE_AUTH_RATE_LIMIT_ENABLED", "true");
    vi.stubEnv("VITE_AUTH_RATE_LIMIT_FAIL_OPEN", "false");
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    vi.unstubAllEnvs();
    if (origEnabled !== undefined) vi.stubEnv("VITE_AUTH_RATE_LIMIT_ENABLED", origEnabled);
    if (origFailOpen !== undefined) vi.stubEnv("VITE_AUTH_RATE_LIMIT_FAIL_OPEN", origFailOpen);
    if (origUrl !== undefined) vi.stubEnv("VITE_SUPABASE_URL", origUrl);
    if (origAnon !== undefined) vi.stubEnv("VITE_SUPABASE_ANON_KEY", origAnon);
  });

  it("429 lança AuthRateLimitError", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ ok: false, error: "rate_limit" }),
    }) as unknown as typeof fetch;

    await expect(assertAuthRateLimitAllowed("login", "a@b.com")).rejects.toMatchObject({
      code: "AUTH_RATE_LIMIT",
      failureKind: "limit_exceeded",
    });
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it("500 com failOpen false lança unexpected", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ ok: false, error: "server_error" }),
    }) as unknown as typeof fetch;

    await expect(assertAuthRateLimitAllowed("signup", "a@b.com")).rejects.toMatchObject({
      failureKind: "unexpected",
    });
  });

  it("200 ok não lança", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    }) as unknown as typeof fetch;

    await expect(assertAuthRateLimitAllowed("login", "a@b.com")).resolves.toBeUndefined();
  });

  it("rede falha com failOpen true permite continuar", async () => {
    vi.stubEnv("VITE_AUTH_RATE_LIMIT_FAIL_OPEN", "true");
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network"));

    await expect(assertAuthRateLimitAllowed("login", "a@b.com")).resolves.toBeUndefined();
  });
});

describe("AuthRateLimitError", () => {
  it("is() identifica instância", () => {
    const e = new AuthRateLimitError("msg", "limit_exceeded");
    expect(AuthRateLimitError.is(e)).toBe(true);
    expect(AuthRateLimitError.is(new Error("x"))).toBe(false);
  });
});
