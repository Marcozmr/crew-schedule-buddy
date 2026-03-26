/**
 * Support — Edge Function `send-support-email` (Resend).
 * Usa `supabase.functions.invoke` para que o pedido passe pelo `fetch` autenticado
 * do cliente (`_getAccessToken()`), alinhado com o gateway — evita JWT manual dessincronizado.
 */

import type { Session, User } from '@supabase/supabase-js';
import { FunctionsHttpError } from '@supabase/functions-js';
import { supabase } from '@/integrations/supabase/client';

const isDev = import.meta.env.DEV;

export const ESCALAX_SUPABASE_PROJECT_REF = 'fbryqzwykdhnmskfectg';

/** URL exata do POST (produção EscalaX). */
export const ESCALAX_SEND_SUPPORT_EMAIL_URL = `https://${ESCALAX_SUPABASE_PROJECT_REF}.supabase.co/functions/v1/send-support-email`;

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

/**
 * URL do POST: **mesmo origin** que `VITE_SUPABASE_URL` (JWT e `apikey` devem ser do mesmo projeto
 * que a Edge Function; caso contrário o gateway devolve 401 Invalid JWT).
 */
export function resolveSupportFunctionPostUrl(baseUrl: string | undefined): string {
  const b = baseUrl?.trim();
  if (!b) return ESCALAX_SEND_SUPPORT_EMAIL_URL;
  try {
    return `${new URL(b).origin}/functions/v1/send-support-email`;
  } catch {
    return ESCALAX_SEND_SUPPORT_EMAIL_URL;
  }
}

/** @deprecated */
export function getSendSupportEmailEndpointUrl(baseUrl: string): string {
  return resolveSupportFunctionPostUrl(baseUrl);
}

function getAnonKey(): string {
  return String(
    import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
  ).trim();
}

function hasAnonKey(): boolean {
  return !!getAnonKey();
}

function looksLikeLegacySmtpPayload(text: string): boolean {
  return /AUTH\s+LOGIN|535\s*5\.7\.8|STARTTLS|Deno\.connect|smtp\.|titan|hostgator/i.test(text);
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

/** Quando o JSON não tem `outcome` reconhecido, não mostrar mensagem genérica sem contexto. */
function buildSupportResultLoose(d: Record<string, unknown>, rawText: string): SupportResult {
  const out = inferOutcome(d);
  if (out) return buildSupportResult(d);
  const msg = pickServerUserMessage(d);
  if (msg) {
    return {
      outcome: 'invoke_error',
      stored: !!d.stored,
      emailSent: !!d.sent,
      userMessage: msg,
    };
  }
  return {
    outcome: 'invoke_error',
    stored: false,
    emailSent: false,
    userMessage: `Resposta inesperada do servidor (primeiros 400 caracteres): ${rawText.slice(0, 400)}`,
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
  unauthorized:
    'Sessão expirada ou inválida. Saia e entre de novo na sua conta e tente enviar outra vez.',
  invoke_error:
    'Não foi possível contactar o serviço de suporte. Verifique a ligação à internet e tente de novo.',
  internal_error: 'Não foi possível processar sua solicitação. Tente novamente.',
};

const USER_NETWORK_HINT =
  'Não foi possível contactar o servidor. Verifique a ligação à internet, desative VPN ou bloqueadores agressivos e tente de novo.';

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

function warnIfNotResendTransport(d: Record<string, unknown> | null, label: string) {
  if (!d) return;
  if (d.transport !== 'resend') {
    console.warn(
      `[support-service] ${label}: resposta sem transport:resend — possível outro backend. Corpo:`,
      d,
    );
  }
}

/** Decodifica payload JWT (sem verificar assinatura) — só para diagnóstico em DEV. */
function decodeJwtPayloadUnsafe(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(b64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function projectRefFromJwtPayload(p: Record<string, unknown>): string | null {
  const ref = p.ref;
  if (typeof ref === 'string' && ref.trim()) return ref.trim();
  const iss = p.iss;
  if (typeof iss === 'string') {
    const m = iss.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
    if (m) return m[1];
  }
  return null;
}

/**
 * Invoca a Edge Function com o mesmo transporte que o resto do SDK: `customFetch` do cliente
 * injeta `Authorization` a partir de `_getAccessToken()` no momento do pedido.
 */
async function invokeSendSupportEmail(body: Record<string, unknown>): Promise<{
  status: number;
  text: string;
  json: Record<string, unknown> | null;
}> {
  const expectedUrl = resolveSupportFunctionPostUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined);
  console.log('[support-service] expected function URL:', expectedUrl);
  console.log('[support-service] payload:', {
    ...body,
    message: typeof body.message === 'string' ? `${body.message.slice(0, 160)}…` : body.message,
  });
  console.log('[support-service] fetch start');

  const { data, error } = await supabase.functions.invoke('send-support-email', { body });

  if (error) {
    const isHttp =
      error instanceof FunctionsHttpError || (error as Error)?.name === 'FunctionsHttpError';
    if (isHttp && (error as FunctionsHttpError).context instanceof Response) {
      const res = (error as FunctionsHttpError).context as Response;
      const status = res.status;
      const text = await res.text();
      let json: Record<string, unknown> | null = null;
      try {
        if (text.trim().startsWith('{')) json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        /* ignore */
      }
      console.log('[support-service] fetch resolved');
      console.log('[support-service] HTTP status:', status);
      console.log('[support-service] response body:', json ?? (text.length > 4000 ? `${text.slice(0, 4000)}…` : text));
      return { status, text, json };
    }
    console.error('[support-service] caught error:', error);
    throw error;
  }

  const json =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  const text = json ? JSON.stringify(data) : String(data ?? '');
  console.log('[support-service] fetch resolved');
  console.log('[support-service] HTTP status:', 200);
  console.log('[support-service] response body:', json ?? text);
  return { status: 200, text, json };
}

function logSupportSessionDev(
  phase: string,
  session: Session | null,
  user: User | null,
  extra: { refreshAttempted: boolean; refreshResult: string },
) {
  if (!isDev) return;
  const exp = session?.expires_at;
  const expMs = exp != null ? exp * 1000 : null;
  console.log(`[support-service] [dev] ${phase}`, {
    hasSession: !!session,
    hasUser: !!user,
    accessTokenExists: !!session?.access_token,
    tokenLength: session?.access_token?.length ?? 0,
    expires_at: exp ?? null,
    expires_in_ms_from_now: expMs != null ? Math.round(expMs - Date.now()) : null,
    refreshAttempted: extra.refreshAttempted,
    refreshResult: extra.refreshResult,
  });
}

/**
 * Garante access_token alinhado com o servidor: `getSession()` sozinho pode devolver JWT expirado em cache.
 * Fluxo: getUser() → (se falhar) refreshSession → getUser() → getSession().
 */
async function resolveAccessTokenForSupport(): Promise<
  | { ok: true; accessToken: string; tokenSource: string }
  | { ok: false; result: SupportResult }
> {
  let refreshAttempted = false;
  let refreshResult = 'not_attempted';

  const { data: u1, error: err1 } = await supabase.auth.getUser();
  const { data: snapAfterUser } = await supabase.auth.getSession();
  logSupportSessionDev('after getUser()', snapAfterUser.session ?? null, u1.user ?? snapAfterUser.session?.user ?? null, {
    refreshAttempted,
    refreshResult,
  });

  if (err1 || !u1.user) {
    refreshAttempted = true;
    const { data: ref, error: refErr } = await supabase.auth.refreshSession();
    refreshResult = refErr?.message ?? (ref.session ? 'ok_session' : 'no_session');
    logSupportSessionDev('after refreshSession (getUser falhou)', ref.session ?? null, ref.session?.user ?? null, {
      refreshAttempted,
      refreshResult,
    });

    const { data: u2, error: err2 } = await supabase.auth.getUser();
    if (err2 || !u2.user) {
      const r: SupportResult = {
        outcome: 'unauthorized',
        stored: false,
        emailSent: false,
        userMessage:
          'Sessão não encontrada ou expirada. Faça login novamente e tente enviar.',
      };
      logSupportSessionDev('getUser ainda inválido após refresh', null, null, {
        refreshAttempted,
        refreshResult: err2?.message ?? 'no_user',
      });
      return { ok: false, result: r };
    }
  }

  const { data: sData } = await supabase.auth.getSession();
  let session = sData.session ?? null;
  logSupportSessionDev('getSession após getUser/refresh', session, session?.user ?? null, {
    refreshAttempted,
    refreshResult,
  });

  const expiresAtMs = session?.expires_at ? session.expires_at * 1000 : 0;
  const expired = expiresAtMs > 0 && expiresAtMs < Date.now();
  const expiresSoon = expiresAtMs > 0 && expiresAtMs < Date.now() + 60_000;
  if (session?.access_token && (expired || expiresSoon)) {
    refreshAttempted = true;
    const { data: ref, error: refErr } = await supabase.auth.refreshSession();
    refreshResult = refErr?.message ?? (ref.session ? 'ok_session' : 'no_session');
    const { data: again } = await supabase.auth.getSession();
    session = again.session ?? ref.session ?? session;
    logSupportSessionDev('após refresh por expiração', session, session?.user ?? null, {
      refreshAttempted,
      refreshResult,
    });
  }

  const token = session?.access_token?.trim() ? session.access_token : undefined;
  console.log('[support-service] session exists:', !!session);
  console.log('[support-service] user exists:', !!session?.user);
  console.log('[support-service] JWT presente:', !!token);
  console.log('[support-service] token length:', token?.length ?? 0);
  if (session?.expires_at != null) {
    console.log('[support-service] expires_at (unix s):', session.expires_at);
  }

  if (!token) {
    return {
      ok: false,
      result: {
        outcome: 'unauthorized',
        stored: false,
        emailSent: false,
        userMessage:
          'Sessão não encontrada ou expirada. Faça login novamente e tente enviar (o servidor exige JWT de utilizador).',
      },
    };
  }

  const envRef = extractProjectRefFromSupabaseUrl(
    String(import.meta.env.VITE_SUPABASE_URL || '').trim(),
  );
  if (isDev) {
    const payload = decodeJwtPayloadUnsafe(token);
    const jwtRef = payload ? projectRefFromJwtPayload(payload) : null;
    console.log('[support-service] [dev] JWT vs projeto .env', {
      envProjectRef: envRef,
      jwtProjectRef: jwtRef,
      aligned: jwtRef != null && envRef != null && jwtRef === envRef,
    });
  }

  const tokenSource =
    refreshAttempted && refreshResult !== 'not_attempted'
      ? 'session_after_getUser_and_refresh'
      : 'session_after_getUser';

  return { ok: true, accessToken: token, tokenSource };
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
  const endpointUrl = resolveSupportFunctionPostUrl(baseUrl);

  console.log('[support-service] --- submitSupport ---');
  console.log('[support-service] VITE_SUPABASE_URL ref:', projectRef ?? '(inválido)');
  console.log('[support-service] POST URL (mesmo projeto que a sessão):', endpointUrl);
  if (projectRef && projectRef !== ESCALAX_SUPABASE_PROJECT_REF) {
    console.warn(
      '[support-service] Ambiente não é o projeto EscalaX esperado — ok para dev; JWT e apikey devem ser do mesmo projeto que esta URL.',
    );
  }

  if (!hasAnonKey()) {
    console.warn('[support-service] VITE_SUPABASE_ANON_KEY ausente — POST falhará.');
  }

  const anon = getAnonKey();
  if (!anon) {
    return {
      outcome: 'invoke_error',
      stored: false,
      emailSent: false,
      userMessage:
        'Chave anónima do Supabase ausente (VITE_SUPABASE_ANON_KEY). Configure no build / ambiente.',
    };
  }

  const resolved = await resolveAccessTokenForSupport();
  if (!resolved.ok) {
    console.log('[support-service] final interpreted outcome:', resolved.result.outcome, resolved.result.userMessage);
    return resolved.result;
  }

  if (isDev) {
    console.log('[support-service] [dev] resolved session for diagnostics', {
      tokenSource: resolved.tokenSource,
      note: 'Pedido real usa supabase.functions.invoke → fetch autenticado do cliente (getAccessToken no momento do POST).',
    });
  }

  const envRef = extractProjectRefFromSupabaseUrl(baseUrl!);
  const jwtPayload = decodeJwtPayloadUnsafe(resolved.accessToken);
  const jwtRef = jwtPayload ? projectRefFromJwtPayload(jwtPayload) : null;
  if (envRef && jwtRef && jwtRef !== envRef) {
    return {
      outcome: 'invoke_error',
      stored: false,
      emailSent: false,
      userMessage:
        'A sessão não corresponde ao projeto configurado nesta app (URL/chave Supabase). Ajuste VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para o mesmo projeto, reinicie o app e faça login de novo.',
    };
  }

  const body = {
    name: payload.name,
    email: payload.email,
    category: payload.type,
    subject: payload.subject,
    message: payload.message,
    route: payload.route,
    type: payload.type,
  };

  try {
    let { status, text, json } = await invokeSendSupportEmail(body);

    if (status === 401) {
      console.warn('[support-service] HTTP 401 — refreshSession + getSession e nova tentativa invoke');
      const { data: ref, error: refErr } = await supabase.auth.refreshSession();
      console.log('[support-service] retry refresh result:', refErr?.message ?? 'ok', !!ref.session);
      await supabase.auth.getSession();
      const second = await invokeSendSupportEmail(body);
      status = second.status;
      text = second.text;
      json = second.json;
    }

    if (status === 401) {
      const d = json ?? normalizeInvokeData(text);
      const r: SupportResult = {
        outcome: 'unauthorized',
        stored: false,
        emailSent: false,
        userMessage:
          pickServerUserMessage(d ?? {}) ??
          'Sessão não aceite pelo servidor. Saia da conta, entre de novo e tente enviar outra vez.',
      };
      console.log('[support-service] final interpreted outcome:', r.outcome, r.userMessage);
      return r;
    }

    const d = json ?? normalizeInvokeData(text);

    if (d) {
      warnIfNotResendTransport(d, 'POST response');
      const r = buildSupportResultLoose(d, text);
      console.log('[support-service] final interpreted outcome:', r.outcome, r.userMessage);
      return r;
    }

    const legacySmtp = looksLikeLegacySmtpPayload(text);
    const r: SupportResult = {
      outcome: 'invoke_error',
      stored: false,
      emailSent: false,
      userMessage: resolveUserMessage(
        'invoke_error',
        text.trim() ? text.slice(0, 500) : `HTTP ${status} — resposta não JSON`,
        legacySmtp,
      ),
    };
    console.log('[support-service] final interpreted outcome:', r.outcome, r.userMessage);
    return r;
  } catch (err) {
    console.error('[support-service] caught error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    const isNetwork =
      /fetch|network|failed|load|CORS|cors|blocked|aborted|Failed to fetch/i.test(msg) ||
      (typeof err === 'object' &&
        err !== null &&
        'name' in err &&
        String((err as { name?: string }).name) === 'TypeError');
    if (isDev && isNetwork) {
      console.warn('[support-service] rede/CORS (detalhe técnico):', msg);
    }
    const r: SupportResult = {
      outcome: 'invoke_error',
      stored: false,
      emailSent: false,
      userMessage: isNetwork ? USER_NETWORK_HINT : resolveUserMessage('invoke_error', msg, false),
    };
    console.log('[support-service] final interpreted outcome:', r.outcome, r.userMessage);
    return r;
  }
}
