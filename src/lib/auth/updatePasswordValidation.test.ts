import { describe, expect, it } from "vitest";
import { isPasswordPairValid, validateNewPasswordPair, PASSWORD_MIN_LENGTH } from "./updatePasswordValidation";

const STRONG = "ValidPass1!";

describe("validateNewPasswordPair", () => {
  it("campos vazios", () => {
    const e = validateNewPasswordPair("", "");
    expect(e.password).toBeTruthy();
    expect(e.confirmPassword).toBeTruthy();
  });

  it("senha fraca (curta ou sem requisitos)", () => {
    const e = validateNewPasswordPair("12345", "12345");
    expect(e.password).toBeTruthy();
    expect(e.password).toContain(String(PASSWORD_MIN_LENGTH));
  });

  it("confirmação diferente", () => {
    const e = validateNewPasswordPair(STRONG, STRONG + "x");
    expect(e.confirmPassword).toBeTruthy();
  });

  it("válido com senha forte", () => {
    expect(isPasswordPairValid(STRONG, STRONG)).toBe(true);
    expect(validateNewPasswordPair(STRONG, STRONG)).toEqual({});
  });
});
