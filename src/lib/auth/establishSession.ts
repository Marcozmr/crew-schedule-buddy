import type { SupabaseClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";
import {
  getParam,
  parseAuthUrlParts,
  type ParsedAuthUrl,
} from "./callbackParams";

export type EstablishSessionResult =
  | { ok: true; session: Session | null; parts: ParsedAuthUrl }
  | { ok: false; parts: ParsedAuthUrl; error: Error };

function devLog(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.info("[auth/establishSession]", ...args);
  }
}

/**
 * Troca código PKCE ou define sessão a partir dos tokens no hash, depois alinha getSession().
 */
export async function establishSessionFromCurrentUrl(
  supabase: SupabaseClient,
  href: string,
): Promise<EstablishSessionResult> {
  const url = new URL(href);
  const parts = parseAuthUrlParts(url.hash, url.search);

  const hashError = getParam(parts, "error");
  if (hashError) {
    devLog("hash contém error, sem estabelecer sessão", hashError);
    return { ok: true, session: null, parts };
  }

  if (parts.searchParams.has("code")) {
    devLog("PKCE: exchangeCodeForSession");
    const { error } = await supabase.auth.exchangeCodeForSession(href);
    if (error) {
      return { ok: false, parts, error };
    }
    const { data } = await supabase.auth.getSession();
    return { ok: true, session: data.session ?? null, parts };
  }

  const access_token = getParam(parts, "access_token");
  const refresh_token = getParam(parts, "refresh_token");

  if (access_token && refresh_token) {
    devLog("Implicit: setSession a partir do hash");
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) {
      return { ok: false, parts, error };
    }
    const { data } = await supabase.auth.getSession();
    return { ok: true, session: data.session ?? null, parts };
  }

  /* Cliente já pode ter consumido o hash (detectSessionInUrl) */
  const { data: existing, error: getErr } = await supabase.auth.getSession();
  if (getErr) {
    return { ok: false, parts, error: getErr };
  }
  devLog("Sem tokens na URL; sessão atual:", !!existing.session);
  return { ok: true, session: existing.session ?? null, parts };
}
