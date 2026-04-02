import type { Session, User } from "@supabase/supabase-js";

/**
 * Estado de acesso derivado da sessão Supabase (UI e guards).
 */
export type AuthAccessState =
  | "loading"
  | "unauthenticated"
  | "needs_email_confirmation"
  | "authenticated";

/**
 * Email confirmado: coluna em auth.users exposta no objeto User.
 * Provedores OAuth em geral já vêm com confirmação.
 */
export function isEmailConfirmed(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.email_confirmed_at != null && user.email_confirmed_at !== "";
}

export function deriveAuthAccessState(
  loading: boolean,
  session: Session | null,
  user: User | null,
): AuthAccessState {
  if (loading) return "loading";
  if (!session || !user) return "unauthenticated";
  if (!isEmailConfirmed(user)) return "needs_email_confirmation";
  return "authenticated";
}
