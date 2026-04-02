import { AuthRateLimitError } from "./authRateLimitError";

export type AuthRateLimitAction =
  | "signup"
  | "login"
  | "forgot_password"
  | "resend_confirmation";

/** Mensagem única e segura (sem números internos). */
export const AUTH_RATE_LIMIT_USER_MESSAGE =
  "Demasiadas tentativas neste período. Aguarde alguns minutos e tente novamente.";

const SERVER_CHECK_FAILED_MESSAGE =
  "Não foi possível validar o pedido de segurança. Tente novamente dentro de instantes.";

function baseUrl(): string | null {
  const u = import.meta.env.VITE_SUPABASE_URL?.trim();
  return u || null;
}

function anonKey(): string {
  return (
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
    ""
  );
}

function failOpen(): boolean {
  return import.meta.env.VITE_AUTH_RATE_LIMIT_FAIL_OPEN !== "false";
}

function enabled(): boolean {
  return import.meta.env.VITE_AUTH_RATE_LIMIT_ENABLED !== "false";
}

type InvokePayload = { ok?: boolean; error?: string };

/**
 * Garante que o pedido passa no rate limit do backend antes de chamar `supabase.auth.*`.
 * Em falha de rede ou 5xx, comportamento controlado por `VITE_AUTH_RATE_LIMIT_FAIL_OPEN` (default: aberto).
 */
export async function assertAuthRateLimitAllowed(
  action: AuthRateLimitAction,
  email?: string | null,
): Promise<void> {
  if (!enabled()) return;

  const url = baseUrl();
  const key = anonKey();
  if (!url || !key) {
    if (import.meta.env.DEV) {
      console.warn("[auth-rate-limit] URL ou chave anon ausentes — ignorado.");
    }
    return;
  }

  const endpoint = `${url.replace(/\/$/, "")}/functions/v1/auth-rate-limit`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify({
        action,
        email: email ?? null,
      }),
    });
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[auth-rate-limit] rede:", e);
    }
    if (failOpen()) return;
    throw new AuthRateLimitError(SERVER_CHECK_FAILED_MESSAGE, "unexpected");
  }

  let payload: InvokePayload = {};
  try {
    payload = (await res.json()) as InvokePayload;
  } catch {
    payload = {};
  }

  if (res.ok && payload.ok === true) {
    return;
  }

  if (res.status === 429 || payload.error === "rate_limit") {
    throw new AuthRateLimitError(AUTH_RATE_LIMIT_USER_MESSAGE, "limit_exceeded");
  }

  if (failOpen()) {
    return;
  }

  if (res.status >= 500 || payload.error === "server_error") {
    throw new AuthRateLimitError(SERVER_CHECK_FAILED_MESSAGE, "unexpected");
  }

  throw new AuthRateLimitError(SERVER_CHECK_FAILED_MESSAGE, "unexpected");
}

/** Para testes: interpreta resposta simulada da Edge Function. */
export function parseAuthRateLimitPayloadForTests(
  status: number,
  payload: InvokePayload,
): "ok" | "limit" | "unexpected" {
  if (status === 200 && payload.ok === true) return "ok";
  if (status === 429 || payload.error === "rate_limit") return "limit";
  return "unexpected";
}
