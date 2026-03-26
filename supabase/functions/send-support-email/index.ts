/**
 * send-support-email — Persiste em `feedback_messages` e envia e-mail APENAS via Resend HTTP API.
 *
 * Não existe SMTP, AUTH LOGIN, STARTTLS, Titan, HostGator ou qualquer transporte legado neste ficheiro.
 *
 * Secrets (Supabase → Edge Functions → Secrets):
 *   RESEND_API_KEY   — obrigatório (ex.: re_…)
 *   RESEND_FROM      — obrigatório — remetente verificado na Resend (ex.: "EscalaX <noreply@seudominio.com>")
 *   SUPPORT_TO_EMAIL — obrigatório — inbox de suporte (ex.: support@escalax.app.br)
 *
 * Runtime: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  /** Obrigatório para o browser enviar POST JSON após o preflight OPTIONS. */
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Max-Age": "86400",
  /** Deve cobrir o pedido em Access-Control-Request-Headers do browser. */
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, accept, accept-language, origin, referer, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "X-EscalaX-Support-Transport",
  "X-EscalaX-Support-Transport": "resend",
};

function logStructured(payload: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "send-support-email", ...payload }));
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify({ ...payload, transport: "resend" as const }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const categoryToLabel = (type: string | null | undefined) =>
  type === "suggestion"
    ? "Sugerir melhoria"
    : type === "bug"
      ? "Relatar problema"
      : "Entrar em contato";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Erro desconhecido";
  }
}

function serializeResendError(err: unknown): string {
  if (err == null) return "null";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof o.message === "string") parts.push(o.message);
    if (typeof o.name === "string") parts.push(`name=${o.name}`);
    if (typeof o.statusCode === "number") parts.push(`statusCode=${o.statusCode}`);
    if (parts.length) return parts.join(" | ");
    try {
      return JSON.stringify(err).slice(0, 800);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** E-mail para Reply-To: formulário > conta autenticada */
function resolveReplyToEmail(formEmail: string | null, authEmail: string | undefined): string | null {
  const fromForm = formEmail?.trim() ?? "";
  if (fromForm.includes("@") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromForm)) return fromForm;
  const fromAuth = authEmail?.trim() ?? "";
  if (fromAuth.includes("@") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromAuth)) return fromAuth;
  return null;
}

/** Extrai o e-mail do campo `from` (Resend: "a@b.c" ou "Nome <a@b.c>"). */
function extractEmailFromFromField(from: string): string | null {
  const t = from.trim();
  if (!t) return null;
  const angle = t.match(/<([^>]+)>/);
  if (angle) {
    const inner = angle[1].trim();
    return inner.includes("@") ? inner : null;
  }
  if (t.includes("@") && !/\s/.test(t)) return t;
  return null;
}

function isPlausibleResendFrom(from: string): boolean {
  const email = extractEmailFromFromField(from);
  if (!email) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  return true;
}

function formatSentAtPtBr(): string {
  try {
    return new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "long",
      timeStyle: "short",
    });
  } catch {
    return new Date().toISOString();
  }
}

serve(async (req) => {
  // Linha visível em dashboards que não indexam JSON — confirma que a requisição chegou ao worker.
  console.log(
    `[send-support-email] hit ${req.method} ${req.url} — ver também logs JSON step=request.received`,
  );

  if (req.method === "OPTIONS") {
    logStructured({ step: "request.received", method: "OPTIONS", note: "cors_preflight_only" });
    logStructured({
      step: "cors.preflight",
      allowMethods: "POST, OPTIONS, GET",
      hint: "O POST seguinte deve aparecer como método POST nos logs (se não aparecer, CORS ou rede no browser).",
    });
    logStructured({ step: "transport.selected", transport: "resend" });
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    logStructured({
      step: "request.received",
      method: req.method,
      note: "reject_not_post",
      hint: "O formulário de suporte deve usar POST; OPTIONS é só preflight.",
    });
    logStructured({ step: "final.outcome", outcome: "validation_error" });
    return json(
      {
        outcome: "validation_error",
        sent: false,
        stored: false,
        transport: "resend",
        error: `Método ${req.method} não permitido. Use POST.`,
      },
      405,
    );
  }

  console.log("[send-support-email] POST real do formulário — iniciando auth + payload (não é OPTIONS)");
  logStructured({
    step: "support_form_submit",
    method: "POST",
    phase: "post_received",
    note: "handler_entered_after_cors",
  });
  logStructured({
    step: "request.received",
    method: "POST",
    phase: "support_form_submit",
    note: "post_body_next",
  });
  logStructured({ step: "transport.selected", transport: "resend" });

  try {
    const authHeader = req.headers.get("Authorization");
    const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";

    if (!authHeader?.trim()) {
      logStructured({ step: "request.unauthorized", reason: "no_authorization_header" });
      logStructured({ step: "final.outcome", outcome: "unauthorized" });
      /** HTTP 200 + JSON: o cliente `functions.invoke` não trata como exceção; evita 401 opaco do gateway. */
      return json(
        {
          outcome: "unauthorized",
          sent: false,
          stored: false,
          transport: "resend",
          error:
            "Sessão não enviada. Faça login novamente e tente (cabeçalho Authorization ausente).",
        },
        200,
      );
    }

    if (!bearer) {
      logStructured({ step: "request.unauthorized", reason: "authorization_not_bearer_or_empty_token" });
      logStructured({ step: "final.outcome", outcome: "unauthorized" });
      return json(
        {
          outcome: "unauthorized",
          sent: false,
          stored: false,
          transport: "resend",
          error: "Formato de autorização inválido. Faça login novamente e tente.",
        },
        200,
      );
    }

    logStructured({
      step: "support_form_submit",
      phase: "auth_header_ok",
      method: "POST",
      bearerLen: bearer.length,
      note: "validating_jwt_with_getUser",
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(bearer);
    if (authError || !user) {
      logStructured({
        step: "request.unauthorized",
        reason: "jwt_invalid_or_expired",
        message: authError?.message?.slice(0, 200) ?? "no_user",
      });
      logStructured({ step: "final.outcome", outcome: "unauthorized" });
      /** Mensagem estável para o utilizador — detalhe técnico só nos logs JSON. */
      return json(
        {
          outcome: "unauthorized",
          sent: false,
          stored: false,
          transport: "resend",
          error:
            "Sessão inválida ou expirada. Saia da conta, entre de novo e tente enviar outra vez.",
        },
        200,
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      logStructured({ step: "request.payload.invalid", reason: "json_parse" });
      logStructured({ step: "final.outcome", outcome: "validation_error" });
      return json({
        outcome: "validation_error",
        sent: false,
        stored: false,
        transport: "resend",
        error: "Corpo da requisição inválido",
      }, 200);
    }

    logStructured({
      step: "payload.valid",
      userId: user.id,
      phase: "post_json_ok",
    });

    const { name, email, type, category, subject, message, route } = body as Record<string, unknown>;
    if (!message || typeof message !== "string" || !message.trim()) {
      logStructured({ step: "request.payload.invalid", reason: "missing_message" });
      logStructured({ step: "final.outcome", outcome: "validation_error" });
      return json({
        outcome: "validation_error",
        sent: false,
        stored: false,
        transport: "resend",
        error: "Mensagem é obrigatória",
      }, 200);
    }

    const safeName = typeof name === "string" && name.trim() ? name.trim() : "Usuário";
    const safeType = (typeof type === "string" && type.trim()
      ? type.trim()
      : typeof category === "string" && category.trim()
        ? category.trim()
        : "contact") as string;
    const safeSubjectField = typeof subject === "string" && subject.trim() ? subject.trim() : "Sem assunto";
    const safeEmailRaw = typeof email === "string" && email.trim() ? email.trim() : null;
    const categoryLabel = categoryToLabel(safeType);
    const routeStr = typeof route === "string" && route.trim() ? route.trim() : null;
    const sentAtLabel = formatSentAtPtBr();

    const replyTo = resolveReplyToEmail(safeEmailRaw, user.email ?? undefined);
    if (!replyTo) {
      logStructured({ step: "request.payload.invalid", reason: "no_reply_email" });
      logStructured({ step: "final.outcome", outcome: "validation_error" });
      return json({
        outcome: "validation_error",
        sent: false,
        stored: false,
        transport: "resend",
        error: "Informe um e-mail válido no formulário (necessário para resposta direta).",
      }, 200);
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    logStructured({ step: "feedback.save.start", userId: user.id });

    const { data: feedback, error: insertError } = await serviceClient
      .from("feedback_messages")
      .insert({
        user_id: user.id,
        type: safeType,
        subject: safeSubjectField === "Sem assunto" ? null : safeSubjectField,
        message,
        email: safeEmailRaw ?? replyTo,
        route: routeStr,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !feedback) {
      logStructured({
        step: "feedback.save.failed",
        code: insertError?.code,
        message: insertError?.message?.slice(0, 300),
      });
      logStructured({ step: "final.outcome", outcome: "register_failed" });
      return json(
        {
          outcome: "register_failed",
          sent: false,
          stored: false,
          transport: "resend",
          error: insertError?.message
            ? `Falha ao salvar feedback: ${insertError.message}`
            : "Não foi possível registrar sua solicitação. Tente novamente.",
        },
        200,
      );
    }

    logStructured({ step: "feedback.save.success", feedbackId: feedback.id });

    const apiKeyRaw = Deno.env.get("RESEND_API_KEY");
    const apiKey = apiKeyRaw?.trim() ?? "";
    const supportToRaw = Deno.env.get("SUPPORT_TO_EMAIL")?.trim();
    const fromRaw = Deno.env.get("RESEND_FROM")?.trim();

    logStructured({
      step: "resend.config.check",
      hasResendKey: apiKey.length > 0,
      resendKeyPrefix: apiKey ? `${apiKey.slice(0, 3)}…` : "(empty)",
      hasSupportTo: !!supportToRaw,
      hasResendFrom: !!fromRaw,
    });

    if (!apiKey || !fromRaw || !supportToRaw) {
      const missing = [
        !apiKey && "RESEND_API_KEY",
        !fromRaw && "RESEND_FROM",
        !supportToRaw && "SUPPORT_TO_EMAIL",
      ].filter(Boolean).join(", ");
      logStructured({ step: "resend.config.missing", detail: missing });
      await serviceClient.from("feedback_messages").update({ status: "stored_no_email" }).eq("id", feedback.id);
      logStructured({ step: "final.outcome", outcome: "config_error", feedbackId: feedback.id });
      return json({
        outcome: "config_error",
        sent: false,
        stored: true,
        feedbackId: feedback.id,
        transport: "resend",
        error:
          `Mensagem salva, mas o envio não está configurado no servidor (defina ${missing} nos secrets da função).`,
      });
    }

    if (!isPlausibleResendFrom(fromRaw)) {
      logStructured({
        step: "resend.config.invalid_from",
        fromPreview: fromRaw.slice(0, 80),
        hint: "Use email@dominio ou Nome <email@dominio>; domínio verificado na Resend",
      });
      await serviceClient.from("feedback_messages").update({ status: "stored_no_email" }).eq("id", feedback.id);
      logStructured({ step: "final.outcome", outcome: "config_error", feedbackId: feedback.id });
      return json({
        outcome: "config_error",
        sent: false,
        stored: true,
        feedbackId: feedback.id,
        transport: "resend",
        error:
          "Mensagem salva, mas RESEND_FROM é inválido. Use um endereço verificado na Resend (ex.: onboarding@resend.dev em testes).",
      });
    }

    const resend = new Resend(apiKey);
    const mailSubject = `EscalaX Suporte - ${categoryLabel} - ${safeSubjectField}`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#111827;max-width:640px;margin:0;padding:24px;">
  <h1 style="font-size:18px;margin:0 0 16px;">Nova mensagem — EscalaX Suporte</h1>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:6px 0;color:#6b7280;width:140px;">Nome</td><td style="padding:6px 0;">${escapeHtml(safeName)}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">E-mail (resposta)</td><td style="padding:6px 0;"><a href="mailto:${escapeHtml(replyTo)}">${escapeHtml(replyTo)}</a></td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">Categoria</td><td style="padding:6px 0;">${escapeHtml(categoryLabel)}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">Assunto</td><td style="padding:6px 0;">${escapeHtml(safeSubjectField)}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;vertical-align:top;">Rota / origem</td><td style="padding:6px 0;">${routeStr ? escapeHtml(routeStr) : "—"}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">Enviado em</td><td style="padding:6px 0;">${escapeHtml(sentAtLabel)} (America/Sao_Paulo)</td></tr>
  </table>
  <h2 style="font-size:15px;margin:24px 0 8px;">Mensagem</h2>
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;font-size:14px;white-space:pre-wrap;">${escapeHtml(message).replace(/\r\n/g, "<br/>").replace(/\n/g, "<br/>")}</div>
  <p style="font-size:12px;color:#9ca3af;margin-top:24px;">ID interno: ${escapeHtml(feedback.id)} · User: ${escapeHtml(user.id)}</p>
</body></html>`;

    const text = [
      "Nova mensagem — EscalaX Suporte",
      "",
      `Nome: ${safeName}`,
      `E-mail (resposta): ${replyTo}`,
      `Categoria: ${categoryLabel}`,
      `Assunto: ${safeSubjectField}`,
      `Rota / origem: ${routeStr ?? "—"}`,
      `Enviado em: ${sentAtLabel} (America/Sao_Paulo)`,
      "",
      "Mensagem:",
      message,
      "",
      `ID interno: ${feedback.id} · User: ${user.id}`,
    ].join("\n");

    logStructured({
      step: "resend.send.start",
      to: supportToRaw,
      replyTo,
      subjectPreview: mailSubject.slice(0, 120),
    });

    try {
      const sendResult = await resend.emails.send({
        from: fromRaw,
        to: [supportToRaw],
        subject: mailSubject,
        html,
        text,
        reply_to: replyTo,
      });

      const sendErr = sendResult.error;
      if (sendErr) {
        const errStr = serializeResendError(sendErr);
        logStructured({
          step: "resend.send.failed",
          phase: "api_error_field",
          reason: errStr.slice(0, 800),
        });
        throw new Error(errStr || "Resend returned error");
      }

      const emailId =
        sendResult.data && typeof sendResult.data === "object" && "id" in sendResult.data
          ? String((sendResult.data as { id: string }).id)
          : undefined;
      logStructured({ step: "resend.send.success", resendEmailId: emailId ?? "unknown" });

      await serviceClient.from("feedback_messages").update({ status: "sent" }).eq("id", feedback.id);
      logStructured({ step: "final.outcome", outcome: "saved_and_emailed", feedbackId: feedback.id });
      return json({
        outcome: "saved_and_emailed",
        sent: true,
        stored: true,
        feedbackId: feedback.id,
        resendEmailId: emailId ?? null,
      });
    } catch (emailErr) {
      const raw = getErrorMessage(emailErr);
      const detail = serializeResendError(emailErr);
      const stack = emailErr instanceof Error ? emailErr.stack : undefined;
      logStructured({
        step: "resend.send.failed",
        phase: "thrown_or_network",
        reason: raw.slice(0, 800),
        detail: detail.slice(0, 800),
        stack: stack ? stack.slice(0, 2000) : undefined,
      });

      await serviceClient.from("feedback_messages").update({ status: "email_failed" }).eq("id", feedback.id);
      logStructured({ step: "final.outcome", outcome: "saved_email_failed", feedbackId: feedback.id });
      return json({
        outcome: "saved_email_failed",
        sent: false,
        stored: true,
        feedbackId: feedback.id,
        transport: "resend",
        error: detail || raw || "Falha ao enviar via Resend.",
      });
    }
  } catch (err) {
    const technicalError = getErrorMessage(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logStructured({
      step: "fatal",
      message: technicalError.slice(0, 800),
      stack: stack ? stack.slice(0, 2000) : undefined,
    });
    if (stack) {
      logStructured({ step: "error.stack", stack: stack.slice(0, 2000) });
    }
    logStructured({ step: "final.outcome", outcome: "internal_error" });
    return json(
      {
        outcome: "internal_error",
        sent: false,
        stored: false,
        transport: "resend",
        error:
          "Erro interno ao processar seu pedido. Tente novamente em instantes. Se persistir, contacte support@escalax.app.br.",
      },
      200,
    );
  }
});
