/** Rota única de retorno do Supabase (email confirm, recovery, OAuth callback). */
export const AUTH_CALLBACK_PATH = "/auth/callback";

/** Página de nova senha após link de recuperação válido. */
export const AUTH_UPDATE_PASSWORD_PATH = "/auth/update-password";

export function getAuthCallbackUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${AUTH_CALLBACK_PATH}`;
}

export function getAuthUpdatePasswordUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${AUTH_UPDATE_PASSWORD_PATH}`;
}
