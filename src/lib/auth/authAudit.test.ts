import { describe, expect, it } from "vitest";
import { logAuthAuditEvent } from "./authAudit";

describe("authAudit", () => {
  it("logAuthAuditEvent não lança e aceita meta segura", () => {
    expect(() => logAuthAuditEvent("logout")).not.toThrow();
    expect(() => logAuthAuditEvent("login_failed", { code: "invalid" })).not.toThrow();
  });
});
