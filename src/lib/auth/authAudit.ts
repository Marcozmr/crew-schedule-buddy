/**
 * Auditoria leve de eventos de auth: sem tokens, senhas ou PII completo.
 * Em DEV: console estruturado. Futuro: analytics ou tabela dedicada.
 */

export type AuthAuditEventName =
  | "signup_requested"
  | "signup_completed"
  | "email_confirmation_sent"
  | "email_confirmed"
  | "login_succeeded"
  | "login_failed"
  | "password_reset_requested"
  | "password_reset_completed"
  | "logout"
  | "auth_callback_error"
  | "blocked_unconfirmed_user"
  | "resend_confirmation_requested"
  | "resend_confirmation_failed";

export type AuthAuditMeta = Record<string, string | number | boolean | undefined>;

const SENSITIVE_KEYS = /password|token|secret|authorization|bearer|refresh|access_token/i;

function sanitizeMeta(meta: AuthAuditMeta | undefined): AuthAuditMeta | undefined {
  if (!meta) return undefined;
  const out: AuthAuditMeta = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SENSITIVE_KEYS.test(k)) continue;
    if (typeof v === "string" && v.length > 120) {
      out[k] = `${v.slice(0, 40)}…`;
      continue;
    }
    out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export function logAuthAuditEvent(name: AuthAuditEventName, meta?: AuthAuditMeta): void {
  const safe = sanitizeMeta(meta);
  if (import.meta.env.DEV) {
    console.info("[auth/audit]", name, safe ?? {});
  }
}

/** Domínio do email apenas (ex.: para falhas de login sem expor endereço completo em logs). */
export function emailDomainOnly(email: string | undefined): string | undefined {
  if (!email || !email.includes("@")) return undefined;
  return email.split("@")[1]?.toLowerCase();
}
