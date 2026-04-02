import { describe, expect, it, vi, beforeEach } from "vitest";
import { establishSessionFromCurrentUrl } from "./establishSession";
import type { SupabaseClient } from "@supabase/supabase-js";

function mockClient(overrides: Partial<SupabaseClient["auth"]> = {}) {
  return {
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
      setSession: vi.fn().mockResolvedValue({ error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      ...overrides,
    },
  } as unknown as SupabaseClient;
}

describe("establishSessionFromCurrentUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna sem sessão quando hash tem error", async () => {
    const supabase = mockClient();
    const href = "https://app.test/auth/callback#error=access_denied";
    const r = await establishSessionFromCurrentUrl(supabase, href);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.session).toBeNull();
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("PKCE: chama exchangeCodeForSession", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
    const getSession = vi
      .fn()
      .mockResolvedValueOnce({ data: { session: { access_token: "x" } }, error: null });
    const supabase = mockClient({ exchangeCodeForSession, getSession });
    const href = "https://app.test/auth/callback?code=abc";
    const r = await establishSessionFromCurrentUrl(supabase, href);
    expect(exchangeCodeForSession).toHaveBeenCalledWith(href);
    expect(r.ok).toBe(true);
  });

  it("implicit: setSession com tokens", async () => {
    const setSession = vi.fn().mockResolvedValue({ error: null });
    const getSession = vi
      .fn()
      .mockResolvedValue({ data: { session: { access_token: "a" } }, error: null });
    const supabase = mockClient({ setSession, getSession });
    const href =
      "https://app.test/auth/callback#access_token=aa&refresh_token=bb&type=recovery";
    const r = await establishSessionFromCurrentUrl(supabase, href);
    expect(setSession).toHaveBeenCalledWith({ access_token: "aa", refresh_token: "bb" });
    expect(r.ok).toBe(true);
  });
});
