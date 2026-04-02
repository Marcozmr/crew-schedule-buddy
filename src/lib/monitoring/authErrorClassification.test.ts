import { describe, expect, it } from "vitest";
import { AuthFlowError, AUTH_FLOW_CODES } from "@/lib/auth/authErrors";
import { classifyAuthRelatedError } from "./authErrorClassification";

describe("classifyAuthRelatedError", () => {
  it("trata AuthFlowError como operacional", () => {
    expect(classifyAuthRelatedError(new AuthFlowError(AUTH_FLOW_CODES.EMAIL_NOT_CONFIRMED))).toBe(
      "operational",
    );
  });

  it("classifica credenciais inválidas como operacional", () => {
    expect(classifyAuthRelatedError({ code: "invalid_credentials", message: "x" })).toBe("operational");
  });

  it("classifica rate limit como operacional", () => {
    expect(classifyAuthRelatedError({ code: "over_email_send_rate_limit", message: "x" })).toBe(
      "operational",
    );
  });

  it("classifica erro desconhecido como inesperado", () => {
    expect(classifyAuthRelatedError({ code: "unexpected_bug", message: "x" })).toBe("unexpected");
  });

  it("classifica ausência de erro como inesperado", () => {
    expect(classifyAuthRelatedError(null)).toBe("unexpected");
  });
});
