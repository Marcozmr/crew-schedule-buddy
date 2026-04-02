/**
 * Erros de fluxo de auth tratados na camada de aplicação (não expostos crus ao utilizador).
 */

export const AUTH_FLOW_CODES = {
  EMAIL_NOT_CONFIRMED: "EMAIL_NOT_CONFIRMED",
} as const;

export type AuthFlowCode = (typeof AUTH_FLOW_CODES)[keyof typeof AUTH_FLOW_CODES];

export class AuthFlowError extends Error {
  readonly flowCode: AuthFlowCode;

  constructor(flowCode: AuthFlowCode, message?: string) {
    super(message ?? flowCode);
    this.name = "AuthFlowError";
    this.flowCode = flowCode;
  }

  static is(e: unknown): e is AuthFlowError {
    return e instanceof AuthFlowError;
  }
}
