import { describe, expect, it } from "vitest";
import { sanitizeAuthEventPayload } from "./sanitizeAuthEventPayload";

describe("sanitizeAuthEventPayload", () => {
  it("retorna objeto vazio para entrada vazia", () => {
    expect(sanitizeAuthEventPayload(undefined)).toEqual({});
    expect(sanitizeAuthEventPayload(null)).toEqual({});
  });

  it("remove chaves que parecem sensíveis", () => {
    expect(
      sanitizeAuthEventPayload({
        code: "ok",
        password: "x",
        access_token: "t",
        refreshToken: "r",
        rawHash: "h",
      }),
    ).toEqual({ code: "ok" });
  });

  it("redacta valores que parecem tokens", () => {
    const out = sanitizeAuthEventPayload({
      note: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      safe: "hello",
    });
    expect(out.safe).toBe("hello");
    expect(out.note).toBe("[redacted]");
  });

  it("trunca strings longas", () => {
    const long = "a".repeat(300);
    const out = sanitizeAuthEventPayload({ s: long });
    expect((out.s as string).length).toBeLessThanOrEqual(201);
    expect((out.s as string).endsWith("…")).toBe(true);
  });

  it("preserva booleanos e números finitos", () => {
    expect(
      sanitizeAuthEventPayload({
        ok: true,
        n: 42,
        bad: Number.NaN,
      }),
    ).toEqual({ ok: true, n: 42 });
  });

  it("serializa objetos aninhados de forma segura", () => {
    const out = sanitizeAuthEventPayload({
      ctx: { phase: "login", nested_secret: "no" },
    });
    expect(out.ctx).toContain("phase");
    expect(out.ctx).not.toContain("nested_secret");
  });

  it("limita profundidade e número de chaves", () => {
    let deep: Record<string, unknown> = { v: 1 };
    for (let i = 0; i < 20; i++) {
      deep = { nest: deep };
    }
    expect(Object.keys(sanitizeAuthEventPayload(deep)).length).toBeLessThanOrEqual(1);

    const many: Record<string, unknown> = {};
    for (let i = 0; i < 50; i++) {
      many[`k${i}`] = i;
    }
    expect(Object.keys(sanitizeAuthEventPayload(many)).length).toBeLessThanOrEqual(32);
  });
});
