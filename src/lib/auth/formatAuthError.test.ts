import { describe, expect, it } from "vitest";
import { formatAuthErrorForUser } from "./formatAuthError";
import { AuthFlowError, AUTH_FLOW_CODES } from "./authErrors";

describe("formatAuthErrorForUser", () => {
  it("AuthFlowError EMAIL_NOT_CONFIRMED", () => {
    expect(formatAuthErrorForUser(new AuthFlowError(AUTH_FLOW_CODES.EMAIL_NOT_CONFIRMED))).toMatch(/confirm/i);
  });

  it("otp_expired", () => {
    expect(formatAuthErrorForUser({ code: "otp_expired", message: "x" })).toContain("expirou");
  });

  it("genérico", () => {
    expect(formatAuthErrorForUser({ message: "Unknown technical" })).toContain("Não foi possível");
  });

  it("null", () => {
    expect(formatAuthErrorForUser(null)).toBeTruthy();
  });
});
