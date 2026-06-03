import { AUTH_CALLBACK_PATH, AUTH_UPDATE_PASSWORD_PATH } from "./authPaths";
import { joinAppPath } from "./appUrl";

export { AUTH_CALLBACK_PATH, AUTH_UPDATE_PASSWORD_PATH } from "./authPaths";

/** URL absoluta de retorno do Supabase (confirmação de email, recovery, OAuth). */
export function getAuthCallbackUrl(): string {
  return joinAppPath(AUTH_CALLBACK_PATH);
}

/** URL absoluta da página de nova senha (referência; fluxo principal passa por /auth/callback). */
export function getAuthUpdatePasswordUrl(): string {
  return joinAppPath(AUTH_UPDATE_PASSWORD_PATH);
}
