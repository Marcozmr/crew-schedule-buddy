import { describe, expect, it } from "vitest";
import type { Session, User } from "@supabase/supabase-js";
import { deriveAuthAccessState, isEmailConfirmed } from "./authAccess";

function user(partial: Partial<User> & { id: string }): User {
  return partial as User;
}

describe("authAccess", () => {
  it("isEmailConfirmed false sem user", () => {
    expect(isEmailConfirmed(null)).toBe(false);
  });

  it("isEmailConfirmed true com email_confirmed_at", () => {
    expect(isEmailConfirmed(user({ id: "1", email_confirmed_at: "2020-01-01T00:00:00Z" }))).toBe(true);
  });

  it("deriveAuthAccessState: loading", () => {
    expect(deriveAuthAccessState(true, null, null)).toBe("loading");
  });

  it("deriveAuthAccessState: needs_email_confirmation", () => {
    const u = user({ id: "1", email: "a@b.com", email_confirmed_at: undefined });
    const session = { access_token: "t", user: u } as Session;
    expect(deriveAuthAccessState(false, session, u)).toBe("needs_email_confirmation");
  });

  it("deriveAuthAccessState: authenticated", () => {
    const u = user({ id: "1", email: "a@b.com", email_confirmed_at: "2020-01-01T00:00:00Z" });
    const session = { access_token: "t", user: u } as Session;
    expect(deriveAuthAccessState(false, session, u)).toBe("authenticated");
  });
});
