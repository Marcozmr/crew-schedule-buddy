/**
 * Parser e decisões de fluxo para callbacks Supabase (hash + query).
 * Funções puras — fáceis de testar.
 */

export type AuthFlowKind =
  | "error"
  | "recovery"
  | "signup"
  | "invite"
  | "magiclink"
  | "email_change"
  | "pkce_code"
  | "implicit_tokens"
  | "unknown";

export type ParsedAuthUrl = {
  /** Hash sem # */
  hashRaw: string;
  /** Query sem ? */
  searchRaw: string;
  hashParams: URLSearchParams;
  searchParams: URLSearchParams;
};

export function stripLeadingHash(hash: string): string {
  return hash.startsWith("#") ? hash.slice(1) : hash;
}

export function parseAuthUrlParts(hash: string, search: string): ParsedAuthUrl {
  const hashRaw = stripLeadingHash(hash);
  const searchRaw = search.startsWith("?") ? search.slice(1) : search;
  return {
    hashRaw,
    searchRaw,
    hashParams: new URLSearchParams(hashRaw),
    searchParams: new URLSearchParams(searchRaw),
  };
}

/** Lê um parâmetro do hash primeiro, depois da query (Supabase varia). */
export function getParam(parts: ParsedAuthUrl, key: string): string | null {
  return parts.hashParams.get(key) ?? parts.searchParams.get(key);
}

export function hasPkceCode(parts: ParsedAuthUrl): boolean {
  return parts.searchParams.has("code");
}

export function hasImplicitTokens(parts: ParsedAuthUrl): boolean {
  return !!(getParam(parts, "access_token") && getParam(parts, "refresh_token"));
}

export function detectFlowKind(parts: ParsedAuthUrl): AuthFlowKind {
  if (getParam(parts, "error")) return "error";
  if (hasPkceCode(parts)) return "pkce_code";
  if (hasImplicitTokens(parts)) {
    const t = (getParam(parts, "type") || "").toLowerCase();
    if (t === "recovery") return "recovery";
    if (t === "signup") return "signup";
    if (t === "invite") return "invite";
    if (t === "magiclink" || t === "email") return "magiclink";
    if (t === "email_change" || t === "email_change_new" || t === "email_change_previous")
      return "email_change";
    return "implicit_tokens";
  }
  return "unknown";
}

export type UserFacingAuthError = {
  title: string;
  message: string;
  /** Sugestão de ação (ex.: pedir novo link) */
  hint?: string;
};

/**
 * Converte erros do callback em mensagens em português (sem texto técnico cru).
 */
export function mapAuthCallbackErrorToUserMessage(parts: ParsedAuthUrl): UserFacingAuthError {
  const error = getParam(parts, "error") || "";
  const code = (getParam(parts, "error_code") || "").toLowerCase();
  const rawDesc = getParam(parts, "error_description") || "";

  if (code === "otp_expired" || rawDesc.toLowerCase().includes("expired")) {
    return {
      title: "Link expirado",
      message:
        "Este link de acesso não é mais válido. Por segurança, os links enviados por email têm validade limitada.",
      hint: "Solicite um novo email de confirmação ou de redefinição de senha.",
    };
  }

  if (error === "access_denied" || code === "access_denied") {
    return {
      title: "Acesso não autorizado",
      message: "Não foi possível concluir a autenticação com este link.",
      hint: "Tente fazer login normalmente ou peça um novo link.",
    };
  }

  if (rawDesc.toLowerCase().includes("invalid") && rawDesc.toLowerCase().includes("expired")) {
    return {
      title: "Link inválido ou expirado",
      message:
        "O link que você usou não é mais válido ou já foi utilizado. Por favor, solicite um novo envio.",
      hint: "Se você já confirmou o email ou redefiniu a senha, faça login com sua conta.",
    };
  }

  if (rawDesc.toLowerCase().includes("already been used") || rawDesc.toLowerCase().includes("already used")) {
    return {
      title: "Link já utilizado",
      message: "Este link já foi usado. Por segurança, cada link só pode ser utilizado uma vez.",
      hint: "Faça login ou solicite um novo email, se necessário.",
    };
  }

  return {
    title: "Não foi possível concluir",
    message:
      "Ocorreu um problema ao processar o link. Tente novamente ou use outro método de acesso.",
    hint: "Se o problema continuar, solicite um novo email ou entre em contato com o suporte.",
  };
}

export type CallbackDecision =
  | { action: "error"; error: UserFacingAuthError }
  | { action: "goto_update_password" }
  | { action: "goto_home_flash"; flash: "email_confirmed" | "magic_link" | "generic" }
  | { action: "goto_home" }
  | { action: "goto_login_needs_signin" };

/**
 * Decide o destino após sessão estabelecida (ou não), com base no `type` do Supabase.
 */
export function decidePostSessionNavigation(args: {
  parts: ParsedAuthUrl;
  hasSession: boolean;
  typeFromParams: string | null;
}): CallbackDecision {
  const { parts, hasSession, typeFromParams } = args;
  const err = getParam(parts, "error");
  if (err) {
    return { action: "error", error: mapAuthCallbackErrorToUserMessage(parts) };
  }

  const t = (typeFromParams || "").toLowerCase();

  if (!hasSession) {
    if (t === "recovery") {
      return {
        action: "error",
        error: {
          title: "Não foi possível redefinir a senha",
          message:
            "O link de recuperação não é mais válido ou a sessão expirou. Solicite um novo email em «Esqueci minha senha».",
          hint: "Cada link de recuperação só pode ser usado dentro do prazo indicado.",
        },
      };
    }
    return { action: "goto_login_needs_signin" };
  }

  if (t === "recovery") {
    return { action: "goto_update_password" };
  }

  if (t === "magiclink" && hasSession) {
    return { action: "goto_home" };
  }

  if (t === "signup" || t === "email") {
    return {
      action: "goto_home_flash",
      flash: t === "signup" ? "email_confirmed" : "magic_link",
    };
  }

  if (t === "invite") {
    return { action: "goto_home" };
  }

  if (t === "email_change" || t === "email_change_new" || t === "email_change_previous") {
    return { action: "goto_home_flash", flash: "generic" };
  }

  /* Sessão sem type explícito (ex.: OAuth) — entra no app */
  return { action: "goto_home" };
}
