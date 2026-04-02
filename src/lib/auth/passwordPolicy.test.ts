import { describe, expect, it } from "vitest";
import { evaluatePasswordStrength, isPasswordStrong, PASSWORD_MIN_LENGTH } from "./passwordPolicy";

describe("passwordPolicy", () => {
  it("rejeita senha fraca (curta)", () => {
    const r = evaluatePasswordStrength("Ab1!");
    expect(r.valid).toBe(false);
    expect(r.primaryError).toMatch(/8 caracteres/i);
  });

  it("rejeita sem maiúscula", () => {
    const r = evaluatePasswordStrength("senhafraca1!");
    expect(r.valid).toBe(false);
    expect(r.checks.hasUpper).toBe(false);
  });

  it("aceita senha forte", () => {
    const p = "SenhaForte1!";
    expect(isPasswordStrong(p)).toBe(true);
    expect(evaluatePasswordStrength(p).valid).toBe(true);
  });

  it("PASSWORD_MIN_LENGTH é 8", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });
});
