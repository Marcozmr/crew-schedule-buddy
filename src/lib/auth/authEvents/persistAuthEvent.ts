import { supabase } from "@/integrations/supabase/client";
import type { AuthEventName } from "./authEventNames";

export function persistEnabled(): boolean {
  return import.meta.env.VITE_AUTH_AUDIT_PERSIST_ENABLED !== "false";
}

function clientRoute(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.pathname.slice(0, 512) || null;
}

function clientOrigin(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.origin.slice(0, 512) || null;
}

/**
 * Persistência opcional via RPC (nunca lança para o chamador — erros só em DEV).
 */
export async function persistAuthEventRemote(params: {
  name: AuthEventName;
  metadata: Record<string, string | number | boolean | null>;
}): Promise<void> {
  if (!persistEnabled()) return;

  const { error } = await supabase.rpc("log_auth_audit_event", {
    p_event_name: params.name,
    p_metadata: params.metadata,
    p_route: clientRoute(),
    p_origin: clientOrigin(),
  });

  if (error && import.meta.env.DEV) {
    console.warn("[auth/events] persist:", error.message);
  }
}

export { clientRoute, clientOrigin };
