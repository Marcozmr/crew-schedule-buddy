export const AUTH_FLASH_STORAGE_KEY = "escalax_auth_flash";

export type AuthFlashKey =
  | "email_confirmed"
  | "magic_link"
  | "generic"
  | "session_missing"
  | "password_updated";

export function setAuthFlash(key: AuthFlashKey): void {
  try {
    sessionStorage.setItem(AUTH_FLASH_STORAGE_KEY, key);
  } catch {
    /* ignore */
  }
}

export function consumeAuthFlash(): AuthFlashKey | null {
  try {
    const v = sessionStorage.getItem(AUTH_FLASH_STORAGE_KEY);
    if (!v) return null;
    sessionStorage.removeItem(AUTH_FLASH_STORAGE_KEY);
    const allowed: AuthFlashKey[] = [
      "email_confirmed",
      "magic_link",
      "generic",
      "session_missing",
      "password_updated",
    ];
    return allowed.includes(v as AuthFlashKey) ? (v as AuthFlashKey) : null;
  } catch {
    return null;
  }
}
