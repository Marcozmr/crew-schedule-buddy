/**
 * Erro de rate limit no servidor (Edge Function + Postgres).
 * Não expor detalhes técnicos (janelas, contadores, IPs).
 */

export type AuthRateLimitFailureKind = "limit_exceeded" | "temporary_block" | "unexpected";

export class AuthRateLimitError extends Error {
  readonly code = "AUTH_RATE_LIMIT" as const;
  readonly failureKind: AuthRateLimitFailureKind;

  constructor(message: string, failureKind: AuthRateLimitFailureKind) {
    super(message);
    this.name = "AuthRateLimitError";
    this.failureKind = failureKind;
  }

  static is(e: unknown): e is AuthRateLimitError {
    return e instanceof AuthRateLimitError;
  }
}
