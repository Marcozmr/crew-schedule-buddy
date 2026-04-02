import { AuthFlowError } from "@/lib/auth/authErrors";
import { AuthRateLimitError } from "@/lib/auth/authRateLimitError";

export type AuthErrorKind = "operational" | "unexpected";

/**
 * Classifica erros de auth/Supabase para não inundar o Sentry com falhas esperadas (credenciais, rate limit, etc.).
 */
export function classifyAuthRelatedError(err: unknown): AuthErrorKind {
  if (!err) return "unexpected";
  if (AuthRateLimitError.is(err)) return "operational";
  if (AuthFlowError.is(err)) return "operational";

  const auth = err as { code?: string; message?: string; name?: string };
  const code = String(auth.code || "").toLowerCase();
  const msg = String(auth.message || err || "").toLowerCase();

  const operationalCodes = new Set([
    "invalid_credentials",
    "email_not_confirmed",
    "user_already_exists",
    "signup_disabled",
    "over_email_send_rate_limit",
    "otp_expired",
    "weak_password",
    "same_password",
    "session_expired",
    "user_not_found",
  ]);
  if (operationalCodes.has(code)) return "operational";

  if (code === "invalid_grant") return "operational";
  if (code === "invalid_request" && (msg.includes("expired") || msg.includes("otp"))) return "operational";

  if (msg.includes("invalid login")) return "operational";
  if (msg.includes("user already registered")) return "operational";
  if (msg.includes("invalid refresh token")) return "operational";
  if (msg.includes("same password") || (msg.includes("password") && msg.includes("different"))) return "operational";
  if (msg.includes("password") && msg.includes("weak")) return "operational";
  if (msg.includes("signups not allowed")) return "operational";
  if (msg.includes("rate limit")) return "operational";
  if (msg.includes("email not confirmed")) return "operational";

  return "unexpected";
}
