/**
 * Política de senha forte (signup, redefinição e nova senha).
 */

export const PASSWORD_MIN_LENGTH = 8;

export type PasswordStrengthResult = {
  valid: boolean;
  /** Primeira regra não satisfeita (mensagem curta para UI). */
  primaryError?: string;
  /** Checklist para feedback em tempo real. */
  checks: {
    minLength: boolean;
    hasUpper: boolean;
    hasLower: boolean;
    hasDigit: boolean;
    hasSpecial: boolean;
  };
};

const UPPER = /[A-Z]/;
const LOWER = /[a-z]/;
const DIGIT = /\d/;
/** Caracteres especiais comuns (ASCII + alguns símbolos). */
const SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const p = password;
  const checks = {
    minLength: p.length >= PASSWORD_MIN_LENGTH,
    hasUpper: UPPER.test(p),
    hasLower: LOWER.test(p),
    hasDigit: DIGIT.test(p),
    hasSpecial: SPECIAL.test(p),
  };

  const valid = Object.values(checks).every(Boolean);

  let primaryError: string | undefined;
  if (!checks.minLength) {
    primaryError = `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  } else if (!checks.hasUpper) {
    primaryError = "Inclua pelo menos uma letra maiúscula.";
  } else if (!checks.hasLower) {
    primaryError = "Inclua pelo menos uma letra minúscula.";
  } else if (!checks.hasDigit) {
    primaryError = "Inclua pelo menos um número.";
  } else if (!checks.hasSpecial) {
    primaryError = "Inclua pelo menos um caractere especial (!@#$%…).";
  }

  return { valid, primaryError, checks };
}

export function isPasswordStrong(password: string): boolean {
  return evaluatePasswordStrength(password).valid;
}
