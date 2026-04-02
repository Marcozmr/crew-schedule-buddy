import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import * as Sentry from "@sentry/react";
import { getEscalaxBuildId } from "@/lib/build-id";
import { useAuth } from "@/lib/auth-context";

const env = import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE;

/**
 * Sincroniza rota, estado de sessão e utilizador (apenas id) com o scope global do Sentry.
 * Deve montar dentro de `BrowserRouter` e `AuthProvider`.
 */
export function SentryRuntimeContext() {
  const location = useLocation();
  const { user, session } = useAuth();

  useEffect(() => {
    const path = location.pathname + (location.search ? " [query]" : "");
    Sentry.setTag("route", path);
    Sentry.setContext("escalax", {
      route: location.pathname,
      environment: env,
      build_id: getEscalaxBuildId(),
      auth_state: session && user ? "authenticated" : "anonymous",
    });
  }, [location.pathname, location.search, session, user]);

  useEffect(() => {
    if (user?.id) {
      Sentry.setUser({ id: user.id });
    } else {
      Sentry.setUser(null);
    }
  }, [user?.id]);

  return null;
}
