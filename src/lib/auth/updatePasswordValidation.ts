import { evaluatePasswordStrength } from "./passwordPolicy";

export { PASSWORD_MIN_LENGTH } from "./passwordPolicy";

export type PasswordFieldErrors = {
  password?: string;
  confirmPassword?: string;
};

export function validateNewPasswordPair(password: string, confirmPassword: string): PasswordFieldErrors {
  const errors: PasswordFieldErrors = {};
  const p = password.trim();
  const c = confirmPassword.trim();

  if (!p) {
    errors.password = "Informe a nova senha.";
  } else {
    const strength = evaluatePasswordStrength(p);
    if (!strength.valid && strength.primaryError) {
      errors.password = strength.primaryError;
    }
  }

  if (!c) {
    errors.confirmPassword = "Confirme a nova senha.";
  } else if (p && c !== p) {
    errors.confirmPassword = "As senhas não coincidem.";
  }

  return errors;
}

export function isPasswordPairValid(password: string, confirmPassword: string): boolean {
  const e = validateNewPasswordPair(password, confirmPassword);
  return !e.password && !e.confirmPassword;
}
