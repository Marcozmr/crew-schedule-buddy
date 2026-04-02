import { useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { establishSessionFromCurrentUrl } from "@/lib/auth/establishSession";
import {
  decidePostSessionNavigation,
  getParam,
  mapAuthCallbackErrorToUserMessage,
  parseAuthUrlParts,
} from "@/lib/auth/callbackParams";
import { formatAuthErrorForUser } from "@/lib/auth/formatAuthError";
import { setAuthFlash } from "@/lib/auth/authFlash";
import { AUTH_UPDATE_PASSWORD_PATH } from "@/lib/auth/authRedirect";
import { logAuthAuditEvent } from "@/lib/auth/authAudit";
import { Button } from "@/components/ui/button";

/**
 * Processa retornos do Supabase (hash implícito, PKCE ?code=, erros).
 * Deve permanecer fora de rotas protegidas.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const ran = useRef(false);
  const [showError, setShowError] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [hint, setHint] = useState<string | undefined>();

  useLayoutEffect(() => {
    if (ran.current) return;
    ran.current = true;

    void (async () => {
      const href = window.location.href;
      const url = new URL(href);
      const parts = parseAuthUrlParts(url.hash, url.search);

      if (import.meta.env.DEV) {
        console.info("[AuthCallback] path", url.pathname, "hash len", url.hash.length, "search", url.search);
      }

      if (getParam(parts, "error")) {
        logAuthAuditEvent("auth_callback_error", { phase: "hash_error" });
        const m = mapAuthCallbackErrorToUserMessage(parts);
        setTitle(m.title);
        setMessage(m.message);
        setHint(m.hint);
        setShowError(true);
        window.history.replaceState({}, "", url.pathname);
        return;
      }

      const result = await establishSessionFromCurrentUrl(supabase, href);
      if (!result.ok) {
        logAuthAuditEvent("auth_callback_error", { phase: "establish_session" });
        if (import.meta.env.DEV) {
          console.warn("[AuthCallback] establishSession failed", result.error);
        }
        setTitle("Não foi possível concluir");
        setMessage(formatAuthErrorForUser(result.error));
        setShowError(true);
        window.history.replaceState({}, "", url.pathname);
        return;
      }

      const type = getParam(result.parts, "type");
      const decision = decidePostSessionNavigation({
        parts: result.parts,
        hasSession: !!result.session,
        typeFromParams: type,
      });

      window.history.replaceState({}, "", url.pathname);

      if (import.meta.env.DEV) {
        console.info("[AuthCallback] decision", decision, "hasSession", !!result.session, "type", type);
      }

      switch (decision.action) {
        case "error": {
          logAuthAuditEvent("auth_callback_error", { phase: "post_session" });
          setTitle(decision.error.title);
          setMessage(decision.error.message);
          setHint(decision.error.hint);
          setShowError(true);
          return;
        }
        case "goto_update_password":
          navigate(AUTH_UPDATE_PASSWORD_PATH, { replace: true });
          return;
        case "goto_home_flash":
          if (decision.flash === "email_confirmed") {
            logAuthAuditEvent("email_confirmed");
          }
          setAuthFlash(decision.flash);
          navigate("/home", { replace: true });
          return;
        case "goto_home":
          navigate("/home", { replace: true });
          return;
        case "goto_login_needs_signin":
          setAuthFlash("session_missing");
          navigate("/login", { replace: true });
          return;
        default: {
          const _exhaustive: never = decision;
          return _exhaustive;
        }
      }
    })();
  }, [navigate]);

  if (showError) {
    return (
      <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{message}</p>
          {hint ? <p className="mt-4 text-sm text-muted-foreground/90">{hint}</p> : null}
          <div className="mt-8 flex flex-col gap-2 sm:flex-row">
            <Button asChild className="w-full sm:flex-1">
              <Link to="/login">Ir para o login</Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:flex-1">
              <Link to="/forgot-password">Esqueci minha senha</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">A concluir autenticação…</p>
      </div>
    </div>
  );
}
