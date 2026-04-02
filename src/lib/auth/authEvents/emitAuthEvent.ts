import type { AuthEventName } from "./authEventNames";
import { sanitizeAuthEventPayload } from "./sanitizeAuthEventPayload";
import { persistAuthEventRemote, persistEnabled } from "./persistAuthEvent";

export type AuthEventMeta = Record<string, string | number | boolean | undefined | null>;

/**
 * Emite evento de auditoria: consola (DEV), opcionalmente Postgres via RPC.
 * Nunca propaga falhas — o fluxo de auth não deve depender disto.
 */
export function emitAuthEvent(name: AuthEventName, meta?: AuthEventMeta): void {
  try {
    const flat = meta ? { ...(meta as Record<string, unknown>) } : undefined;
    const safe = sanitizeAuthEventPayload(flat);

    if (import.meta.env.DEV) {
      console.info("[auth/events]", name, safe);
    }

    if (persistEnabled()) {
      void persistAuthEventRemote({ name, metadata: safe }).catch(() => {
        /* silencioso — persist é best-effort */
      });
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[auth/events] emit falhou (ignorado):", e);
    }
  }
}

/** Compatível com código legado `logAuthAuditEvent`. */
export const logAuthAuditEvent = emitAuthEvent;

/** Domínio do email apenas (sem local-part). */
export function emailDomainOnly(email: string | undefined): string | undefined {
  if (!email || !email.includes("@")) return undefined;
  return email.split("@")[1]?.toLowerCase();
}
