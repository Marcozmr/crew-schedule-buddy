import { describe, expect, it } from "vitest";
import { sanitizeExtra } from "./errorReporting";

describe("sanitizeExtra", () => {
  it("remove valores de chaves sensíveis", () => {
    const out = sanitizeExtra({
      password: "x",
      access_token: "t",
      nested: { refresh_token: "r" },
    });
    expect(out.password).toBe("[redacted]");
    expect(out.access_token).toBe("[redacted]");
    expect((out.nested as Record<string, unknown>).refresh_token).toBe("[redacted]");
  });

  it("redige chave email", () => {
    expect(sanitizeExtra({ email: "a@b.com" }).email).toBe("[redacted]");
  });
});
