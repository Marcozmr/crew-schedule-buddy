/**
 * Support Service — envio via Edge Function `send-support-email`.
 * A mensagem é persistida em `feedback_messages` antes do Resend; falhas de e-mail não apagam o registro.
 */

import { supabase } from '@/integrations/supabase/client';

export interface SupportPayload {
  name: string;
  email: string;
  type: 'suggestion' | 'bug' | 'contact';
  subject: string;
  message: string;
  route: string;
}

export type SupportOutcome =
  | 'email_sent'
  | 'saved_email_failed'
  | 'saved_smtp_not_configured'
  | 'register_failed'
  | 'validation_error'
  | 'unauthorized'
  | 'invoke_error'
  | 'internal_error';

export interface SupportResult {
  outcome: SupportOutcome;
  stored: boolean;
  emailSent: boolean;
  userMessage: string;
}

function supabaseClientConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key =
    import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return !!(url && String(url).trim() && key && String(key).trim());
}

/** Corpo JSON de FunctionsHttpError / resposta com falha */
async function parseErrorResponseBody(error: unknown): Promise<Record<string, unknown> | null> {
  if (!error || typeof error !== 'object') return null;
  const ctx = (error as { context?: unknown }).context;
  if (ctx && typeof ctx === 'object' && 'json' in ctx && typeof (ctx as Response).json === 'function') {
    try {
      return (await (ctx as Response).clone().json()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

function inferOutcome(d: Record<string, unknown>): SupportOutcome | undefined {
  if (typeof d.outcome === 'string') return d.outcome as SupportOutcome;
  if (d.sent === true && d.stored === true) return 'email_sent';
  if (d.stored === true && d.sent === false) return 'saved_email_failed';
  return undefined;
}

function normalizeInvokeData(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      if (typeof p === 'object' && p !== null && !Array.isArray(p)) return p as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

const COPY: Record<SupportOutcome, string> = {
  email_sent: 'Mensagem enviada com sucesso.',
  saved_email_failed:
    'Mensagem salva, mas houve falha no envio do e-mail. Nossa equipe ainda poderá analisar a solicitação.',
  saved_smtp_not_configured:
    'Mensagem salva, mas o envio por e-mail não está disponível no momento. Nossa equipe poderá analisar pelo sistema.',
  register_failed: 'Não foi possível registrar sua solicitação. Tente novamente.',
  validation_error: 'Verifique os dados e tente novamente.',
  unauthorized: 'Sessão expirada ou inválida. Faça login novamente e tente outra vez.',
  invoke_error: 'Não foi possível enviar sua solicitação. Tente novamente.',
  internal_error: 'Não foi possível processar sua solicitação. Tente novamente.',
};

function resolveUserMessage(outcome: SupportOutcome, serverError: string | null): string {
  if (outcome === 'email_sent') return COPY.email_sent;
  if (serverError) return serverError;
  return COPY[outcome] ?? COPY.internal_error;
}

function httpStatusHint(error: unknown): string {
  const ctx = (error as { context?: Response })?.context;
  const st = ctx?.status;
  return typeof st === 'number' ? ` (HTTP ${st})` : '';
}

export async function submitSupport(payload: SupportPayload): Promise<SupportResult> {
  if (!supabaseClientConfigured()) {
    return {
      outcome: 'invoke_error',
      stored: false,
      emailSent: false,
      userMessage:
        'Configuração Supabase ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (ou VITE_SUPABASE_PUBLISHABLE_KEY) no .env.local e reinicie o Vite (npm run dev).',
    };
  }

  if (import.meta.env.DEV) {
    console.log('Support submit start');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const body = {
    name: payload.name,
    email: payload.email,
    type: payload.type,
    category: payload.type,
    subject: payload.subject,
    message: payload.message,
    route: payload.route,
  };

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (import.meta.env.DEV) {
    console.log('Sending to edge function', 'send-support-email', { hasAuth: !!token });
  }

  const { data: rawData, error } = await supabase.functions.invoke('send-support-email', {
    body,
    headers,
  });

  if (import.meta.env.DEV) {
    console.log('Response:', rawData);
    console.log('Error:', error);
  }

  const d = normalizeInvokeData(rawData);

  if (error) {
    const msg = (error as Error)?.message ?? String(error);
    console.error('[support-service] invoke error:', msg + httpStatusHint(error));

    const errBody = (await parseErrorResponseBody(error)) ?? {};
    const errText = typeof errBody.error === 'string' ? errBody.error : null;
    const out = inferOutcome(errBody);

    if (out === 'unauthorized' || errText?.includes('Não autorizado')) {
      return {
        outcome: 'unauthorized',
        stored: false,
        emailSent: false,
        userMessage: errText || COPY.unauthorized,
      };
    }

    if (out && out in COPY) {
      return {
        outcome: out,
        stored: !!errBody.stored,
        emailSent: !!errBody.sent,
        userMessage: resolveUserMessage(out, errText),
      };
    }

    const detail = errText || msg;
    return {
      outcome: 'invoke_error',
      stored: false,
      emailSent: false,
      userMessage: detail ? `${COPY.invoke_error} ${detail}` : COPY.invoke_error,
    };
  }

  if (!d) {
    console.error('[support-service] resposta vazia ou inválida da Edge Function');
    return {
      outcome: 'invoke_error',
      stored: false,
      emailSent: false,
      userMessage: 'Resposta inválida do servidor. Tente novamente.',
    };
  }

  const outcome = inferOutcome(d) ?? 'internal_error';
  const stored = !!d.stored;
  const emailSent = !!d.sent;
  const serverError = typeof d.error === 'string' ? d.error : null;

  return {
    outcome,
    stored,
    emailSent,
    userMessage: resolveUserMessage(outcome, serverError),
  };
}
