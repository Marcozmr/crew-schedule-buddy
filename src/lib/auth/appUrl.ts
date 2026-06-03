/**
 * URL base oficial do EscalaX para links de auth (emailRedirectTo / redirectTo).
 *
 * Prioridade:
 * 1. VITE_APP_URL (injetada no build de produção — Vercel, etc.)
 * 2. window.location.origin (desenvolvimento local ou produção sem env)
 * 3. DEFAULT_PRODUCTION_APP_ORIGIN (fallback SSR/testes em build de produção)
 */

/** Domínio canônico de produção — alinhado ao README e og:url do index.html. */
export const DEFAULT_PRODUCTION_APP_ORIGIN = "https://www.escalax.app.br";

/** Origens de desenvolvimento aceitas no Supabase Redirect URLs. */
export const DEV_AUTH_REDIRECT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
] as const;

export function normalizeAppOrigin(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  try {
    const withScheme = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    return new URL(withScheme).origin;
  } catch {
    return "";
  }
}

/** Valor de VITE_APP_URL após normalização, ou null se ausente/inválido. */
export function getConfiguredAppOrigin(): string | null {
  const raw = import.meta.env.VITE_APP_URL?.trim();
  if (!raw) return null;
  const origin = normalizeAppOrigin(raw);
  return origin || null;
}

/**
 * Origem usada ao montar redirectTo / emailRedirectTo para o Supabase Auth.
 */
export function getAppOrigin(): string {
  const configured = getConfiguredAppOrigin();
  if (configured) return configured;

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  if (import.meta.env.PROD) {
    return DEFAULT_PRODUCTION_APP_ORIGIN;
  }

  return "";
}

export function joinAppPath(path: string): string {
  const origin = getAppOrigin();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return origin ? `${origin}${normalizedPath}` : normalizedPath;
}
