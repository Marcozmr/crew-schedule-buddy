/**
 * Catálogo canónico de eventos de auditoria de autenticação (domínio).
 * Manter alinhado com `log_auth_audit_event` no Postgres.
 */
export const AUTH_EVENT_NAMES = [
  "signup_requested",
  "signup_completed",
  "email_confirmation_sent",
  "email_confirmed",
  "login_succeeded",
  "login_failed",
  "password_reset_requested",
  "password_reset_completed",
  "password_reset_failed",
  "password_reset_rate_limited",
  "resend_confirmation_requested",
  "resend_confirmation_succeeded",
  "resend_confirmation_failed",
  "blocked_unconfirmed_user",
  "logout",
  "auth_callback_error",
] as const;

export type AuthEventName = (typeof AUTH_EVENT_NAMES)[number];
