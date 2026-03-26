/**
 * Support Service — único caminho: Edge Function `send-support-email` (Resend no backend).
 * Não há SMTP, nodemailer nem fetch alternativo no frontend.
 */

import { supabase } from '@/integrations/supabase/client';

/** Project ref do Supabase EscalaX — deve ser o subdomínio de VITE_SUPABASE_URL (*.supabase.co). */
export const ESCALAX_SUPABASE_PROJECT_REF = 'fbryqzwykdhnmskfectg';

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
  | 'config_error'
  | 'saved_email_failed'
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

function isValidSupabaseUrl(url: string | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function extractProjectRefFromSupabaseUrl(url: string): string | null {
  try {
    const h = new URL(url.trim()).hostname.toLowerCase();
    const m = h.match(/^([a-z0-9]+)\.supabase\.co$/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** URL real do POST (mesma base que o cliente Supabase usa para functions.invoke). */
export function getSendSupportEmailEndpointUrl(baseUrl: string): string {
  const b = baseUrl.replace(/\/$/, '');
  return `${b}/functions/v1/send-support-email`;
}

function getAnonKey(): string {
  return String(
    import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
  ).trim();
}

function hasAnonKey(): boolean {
  return !!getAnonKey();
}

/**
 * Fallback quando `functions.invoke` retorna erro HTTP mas o corpo é JSON útil,
 * ou quando há falha de rede no cliente Supabase.
 */
async function fetchSupportFunctionDirect(
  endpointUrl: string,
  body: Record<string, unknown>,
  accessToken: string | undefined,
): Promise<{ status: number; text: string; json: Record<string, unknown> | null }> {
  const anon = getAnonKey();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: anon,
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  else if (anon) headers.Authorization = `Bearer ${anon}`;

  const res = await fetch(endpointUrl, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    if (text.trim().startsWith('{')) json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  return { status: res.status, text, json };
}

/** Texto de erro antigo (deploy SMTP / outro backend) — só afeta a mensagem se o JSON não trouxer `transport: resend`. */
function looksLikeLegacySmtpPayload(text: string): boolean {
  return /AUTH\s+LOGIN|535\s*5\.7\.8|STARTTLS|Deno\.connect|smtp\.|titan|hostgator/i.test(text);
}

/** Em DEV: status HTTP + trecho do corpo quando invoke retorna erro (non-2xx). */
async function logEdgeFunctionHttpDetails(error: unknown): Promise<void> {
  if (!import.meta.env.DEV || !error || typeof error !== 'object') return;
  const ctx = (error as { context?: Response }).context;
  if (!ctx || typeof ctx.status !== 'number') return;
  let bodyPreview = '';
  try {
    bodyPreview = (await ctx.clone().text()).slice(0, 500);
  } catch {
    /* ignore */
  }
  console.error(
    '[support-service] send-support-email resposta HTTP:',
    ctx.status,
    ctx.statusText,
    bodyPreview ? `— corpo: ${bodyPreview}` : '',
  );
}

/** Corpo JSON ou texto de FunctionsHttpError (resposta não-2xx) */
async function parseErrorResponseBody(error: unknown): Promise<Record<string, unknown> | null> {
  if (!error || typeof error !== 'object') return null;
  const ctx = (error as { context?: unknown }).context;
  if (!ctx || typeof ctx !== 'object') return null;
  const res = ctx as Response;
  try {
    const text = await res.clone().text();
    if (text.trim().startsWith('{')) {
      return JSON.parse(text) as Record<string, unknown>;
    }
    return { rawBody: text.slice(0, 800) };
  } catch {
    return null;
  }
}

function inferOutcome(d: Record<string, unknown>): SupportOutcome | undefined {
  const o = typeof d.outcome === 'string' ? d.outcome : '';
  if (o === 'saved_and_emailed' || o === 'email_sent') return 'email_sent';
  if (o === 'config_error') return 'config_error';
  if (o === 'validation_error') return 'validation_error';
  if (o === 'saved_email_failed') return 'saved_email_failed';
  if (o === 'internal_error') return 'internal_error';
  if (o === 'register_failed' || o === 'unauthorized') {
    return o as SupportOutcome;
  }
  if (d.sent === true && d.stored === true) return 'email_sent';
  if (d.stored === true && d.sent === false) return 'saved_email_failed';
  return undefined;
}

/** Mensagem amigável: prioriza `error` do JSON da Edge Function. */
function pickServerUserMessage(d: Record<string, unknown>): string | null {
  const e = d.error;
  if (typeof e === 'string' && e.trim()) return e.trim();
  return null;
}

function buildSupportResult(d: Record<string, unknown>): SupportResult {
  warnIfNotResendTransport(d, 'Edge Function response');
  const outcome = inferOutcome(d) ?? 'internal_error';
  const stored = !!d.stored;
  const emailSent = !!d.sent;
  const serverError = pickServerUserMessage(d);
  const legacySmtp = looksLikeLegacySmtpPayload(serverError ?? '');
  return {
    outcome,
    stored,
    emailSent,
    userMessage: resolveUserMessage(outcome, serverError, legacySmtp),
  };
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
  config_error:
    'Mensagem registrada, mas o e-mail não foi entregue: envio não configurado no servidor. Nossa equipe poderá analisar pelo sistema.',
  saved_email_failed:
    'Mensagem salva, mas houve falha no envio do e-mail. Nossa equipe ainda poderá analisar a solicitação.',
  register_failed: 'Não foi possível registrar sua solicitação. Tente novamente.',
  validation_error: 'Verifique os dados e tente novamente.',
  unauthorized: 'Sessão expirada ou inválida. Faça login novamente e tente outra vez.',
  invoke_error: 'Não foi possível enviar sua solicitação. Tente novamente.',
  internal_error: 'Não foi possível processar sua solicitação. Tente novamente.',
};

const LEGACY_SMTP_USER_HINT =
  'O servidor respondeu com erro de e-mail antigo (SMTP). Faça deploy da Edge Function send-support-email (Resend) no projeto Supabase correto e confira VITE_SUPABASE_URL no .env.local.';

function resolveUserMessage(
  outcome: SupportOutcome,
  serverError: string | null,
  legacySmtpDetected: boolean,
): string {
  if (outcome === 'email_sent') return COPY.email_sent;
  if (serverError) return serverError;
  if (legacySmtpDetected && (outcome === 'saved_email_failed' || outcome === 'invoke_error')) {
    return LEGACY_SMTP_USER_HINT;
  }
  return COPY[outcome] ?? COPY.internal_error;
}

function httpStatusHint(error: unknown): string {
  const ctx = (error as { context?: Response })?.context;
  const st = ctx?.status;
  return typeof st === 'number' ? ` (HTTP ${st})` : '';
}

function warnIfNotResendTransport(d: Record<string, unknown> | null, label: string) {
  if (!d) return;
  if (d.transport !== 'resend') {
    console.warn(
      `[support-service] ${label}: resposta sem transport:resend — possível Edge Function antiga (SMTP) ou outro projeto. Corpo:`,
      d,
    );
  }
}

export async function submitSupport(payload: SupportPayload): Promise<SupportResult> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;

  if (!isValidSupabaseUrl(baseUrl)) {
    return {
      outcome: 'invoke_error',
      stored: false,
      emailSent: false,
      userMessage:
        'VITE_SUPABASE_URL inválido ou ausente. Defina a URL do projeto Supabase no .env.local e reinicie o Vite.',
    };
  }

  const projectRef = extractProjectRefFromSupabaseUrl(baseUrl!);
  const endpointUrl = getSendSupportEmailEndpointUrl(baseUrl!);

  console.log('Support submit start');
  console.log('Supabase URL in use:', baseUrl);
  console.log('Supabase project ref:', projectRef ?? '(não extraído — verifique o hostname)');
  console.log('Endpoint (send-support-email):', endpointUrl);

  if (projectRef && projectRef !== ESCALAX_SUPABASE_PROJECT_REF) {
    console.warn(
      '[support-service] VITE_SUPABASE_URL aponta para outro project ref que o esperado para EscalaX. Esperado:',
      ESCALAX_SUPABASE_PROJECT_REF,
      'Obtido:',
      projectRef,
    );
  }

  if (!hasAnonKey()) {
    if (import.meta.env.DEV) {
      console.warn(
        '[EscalaX support] VITE_SUPABASE_ANON_KEY ou VITE_SUPABASE_PUBLISHABLE_KEY ausente — o invoke pode falhar.',
      );
    }
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const body = {
    name: payload.name,
    email: payload.email,
    category: payload.type,
    subject: payload.subject,
    message: payload.message,
    route: payload.route,
    type: payload.type,
  };

  const anon = getAnonKey();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (anon) {
    headers.Authorization = `Bearer ${anon}`;
  }

  console.log('Invoking send-support-email');
  console.log('[support-service] HTTP method: POST');
  console.log('[support-service] request URL:', endpointUrl);
  console.log('[support-service] payload (message truncado):', {
    ...body,
    message: typeof body.message === 'string' ? `${body.message.slice(0, 120)}…` : body.message,
  });

  const { data: rawData, error } = await supabase.functions.invoke('send-support-email', {
    body,
    headers,
  });

  const d = normalizeInvokeData(rawData);

  const ctxErr = error && typeof error === 'object' ? (error as { context?: Response }).context : undefined;
  if (ctxErr && typeof ctxErr.status === 'number') {
    let bodyText = '';
    try {
      bodyText = await ctxErr.clone().text();
    } catch {
      /* ignore */
    }
    console.log('[support-service] invoke falhou — URL:', endpointUrl);
    console.log('[support-service] HTTP status:', ctxErr.status, ctxErr.statusText);
    console.log('[support-service] response body (text):', bodyText.slice(0, 2000));
    let parsedBody: Record<string, unknown> | null = null;
    try {
      if (bodyText.trim().startsWith('{')) parsedBody = JSON.parse(bodyText) as Record<string, unknown>;
    } catch {
      /* ignore */
    }
    if (parsedBody) {
      console.log('[support-service] response body (JSON):', parsedBody);
    }
  } else if (!error) {
    console.log('[support-service] invoke OK — URL:', endpointUrl);
    console.log('[support-service] response body (parsed):', d ?? rawData);
  }

  const invokeErrName = error && typeof error === 'object' && 'name' in error ? String((error as Error).name) : '';
  const invokeErrMsg = error instanceof Error ? error.message : error ? String(error) : '';
  if (error) {
    console.warn('[support-service] invoke error object:', error);
    console.warn('[support-service] invoke error name/message:', invokeErrName, invokeErrMsg);
  }

  /**
   * O cliente Supabase pode marcar `error` em HTTP não-2xx mesmo quando `data` traz JSON com outcome.
   * Priorizar sempre o corpo JSON útil (mesma regra do fetch fallback).
   */
  if (d && inferOutcome(d)) {
    if (error) {
      console.warn(
        '[support-service] invoke retornou erro genérico, mas o corpo JSON é válido — usando outcome do servidor:',
        inferOutcome(d),
        d,
      );
    }
    return buildSupportResult(d);
  }

  /** Só quando invoke falhou (HTTP não-2xx / erro de rede) — evita POST duplicado em sucesso. */
  if (error && hasAnonKey()) {
    try {
      const fb = await fetchSupportFunctionDirect(endpointUrl, body, token);
      console.log('[support-service] fetch fallback status:', fb.status, 'body:', fb.text.slice(0, 800));
      if (fb.json && inferOutcome(fb.json)) {
        warnIfNotResendTransport(fb.json, 'fetch fallback');
        return buildSupportResult(fb.json);
      }
    } catch (fbErr) {
      console.error('[support-service] fetch fallback failed:', fbErr);
    }
  }

  if (error) {
    await logEdgeFunctionHttpDetails(error);
    const msg = (error as Error)?.message ?? String(error);
    console.error('[support-service] invoke error:', msg + httpStatusHint(error));

    const errBody = (await parseErrorResponseBody(error)) ?? {};
    warnIfNotResendTransport(errBody, 'invoke error body');

    const errText = pickServerUserMessage(errBody);
    const rawForLegacy = [errText, msg].filter(Boolean).join(' ');
    const legacySmtp = looksLikeLegacySmtpPayload(rawForLegacy);
    if (legacySmtp) {
      console.error(
        '[support-service] Texto de erro compatível com SMTP legado (não existe neste repo). Redeploy send-support-email (Resend) no projeto',
        projectRef ?? '?',
      );
    }

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
        userMessage: resolveUserMessage(out, errText, legacySmtp),
      };
    }

    const genericInvoke =
      /non-2xx|edge function returned/i.test(msg) && !errText;
    const detail =
      errText ||
      (genericInvoke
        ? 'Não foi possível concluir o envio. Se o problema continuar, tente de novo ou escreva para support@escalax.app.br.'
        : msg);
    return {
      outcome: 'invoke_error',
      stored: false,
      emailSent: false,
      userMessage: resolveUserMessage('invoke_error', detail, legacySmtp),
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

  return buildSupportResult(d);
}
