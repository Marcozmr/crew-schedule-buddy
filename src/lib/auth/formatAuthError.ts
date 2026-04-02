import type { AuthError } from "@supabase/supabase-js";
import { AuthFlowError, AUTH_FLOW_CODES } from "./authErrors";

/**
 * Mensagem segura em português para exibir ao utilizador (sem detalhes técnicos do Supabase).
 */
export function formatAuthErrorForUser(err: unknown): string {
  if (!err) return "Ocorreu um erro inesperado. Tente novamente.";

  if (AuthFlowError.is(err) && err.flowCode === AUTH_FLOW_CODES.EMAIL_NOT_CONFIRMED) {
    return "Confirme o seu email antes de entrar. Verifique a caixa de entrada ou a pasta de spam.";
  }

  const auth = err as Partial<AuthError> & { code?: string };
  const code = (auth.code || "").toLowerCase();
  const msg = String(auth.message || err || "").toLowerCase();

  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "Confirme o seu email antes de entrar. Verifique a caixa de entrada ou a pasta de spam.";
  }

  if (code === "user_already_exists" || msg.includes("user already registered")) {
    return "Já existe uma conta com este email. Tente fazer login ou recuperar a senha.";
  }

  if (code === "signup_disabled" || msg.includes("signups not allowed")) {
    return "Novos registos não estão disponíveis de momento. Tente mais tarde.";
  }

  if (code === "over_email_send_rate_limit" || msg.includes("rate limit")) {
    return "Foram demasiados envios de email. Aguarde alguns minutos e tente novamente.";
  }

  if (code === "otp_expired" || msg.includes("expired")) {
    return "Este link expirou. Solicite um novo envio.";
  }

  if (code === "invalid_credentials" || msg.includes("invalid login")) {
    return "Email ou senha incorretos.";
  }

  if (msg.includes("same password") || msg.includes("should be different")) {
    return "A nova senha deve ser diferente da anterior.";
  }

  if (msg.includes("password") && msg.includes("weak")) {
    return "A senha não cumpre os requisitos de segurança.";
  }

  if (msg.includes("session")) {
    return "Sessão inválida ou expirada. Solicite um novo link de recuperação.";
  }

  return "Não foi possível concluir a operação. Tente novamente ou solicite um novo link.";
}
