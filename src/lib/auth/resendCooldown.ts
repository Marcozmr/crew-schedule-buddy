const PREFIX = "escalax_resend_cooldown_";

function key(email: string): string {
  return PREFIX + email.trim().toLowerCase();
}

/** Cooldown padrão entre reenvios de confirmação (ms). */
export const RESEND_CONFIRMATION_COOLDOWN_MS = 60_000;

export function getResendCooldownRemainingMs(email: string, cooldownMs = RESEND_CONFIRMATION_COOLDOWN_MS): number {
  try {
    const raw = sessionStorage.getItem(key(email));
    if (!raw) return 0;
    const ts = Number.parseInt(raw, 10);
    if (Number.isNaN(ts)) return 0;
    const elapsed = Date.now() - ts;
    return Math.max(0, cooldownMs - elapsed);
  } catch {
    return 0;
  }
}

export function markResendConfirmationAttempt(email: string): void {
  try {
    sessionStorage.setItem(key(email), String(Date.now()));
  } catch {
    /* ignore */
  }
}
