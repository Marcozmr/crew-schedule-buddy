import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function logStructured(payload: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "send-support-email", ...payload }));
}

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  logStructured({ step: "request.received", method: req.method });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStructured({ step: "request.unauthorized", reason: "no_header" });
      return json(
        { outcome: "unauthorized", sent: false, stored: false, error: "Não autorizado. Faça login novamente." },
        401,
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      logStructured({ step: "request.unauthorized", reason: authError?.message || "no_user" });
      return json(
        { outcome: "unauthorized", sent: false, stored: false, error: "Não autorizado. Faça login novamente." },
        401,
      );
    }

    const body = await req.json();
    const { name, email, type, category, subject, message, route } = body;
    if (!message?.trim()) {
      return json({ outcome: "validation_error", sent: false, stored: false, error: "Mensagem é obrigatória" }, 400);
    }

    const safeName = name?.trim() || "Usuário";
    const safeType = (type?.trim() || category?.trim() || "contact") as string;
    const safeSubject = subject?.trim() || null;
    const safeEmail = email?.trim() || null;
    const categoryLabel = categoryToLabel(safeType);

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: feedback, error: insertError } = await serviceClient
      .from("feedback_messages")
      .insert({
        user_id: user.id,
        type: safeType,
        subject: safeSubject,
        message,
        email: safeEmail,
        route: route || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !feedback) {
      logStructured({ step: "db.insert.failed", code: insertError?.code, message: insertError?.message });
      return json(
        {
          outcome: "register_failed",
          sent: false,
          stored: false,
          error: "Não foi possível registrar sua solicitação. Tente novamente.",
        },
        500,
      );
    }

    logStructured({ step: "db.insert.ok", feedbackId: feedback.id });

    const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
    const supportTo = (Deno.env.get("SUPPORT_TO_EMAIL") || "support@escalax.app.br").trim();

    if (!apiKey) {
      logStructured({ step: "resend.config.missing" });
      await serviceClient.from("feedback_messages").update({ status: "stored_no_email" }).eq("id", feedback.id);
      return json({
        outcome: "saved_email_failed",
        sent: false,
        stored: true,
        error:
          "Mensagem salva, mas o envio por e-mail não está configurado no servidor. Nossa equipe poderá analisar pelo sistema.",
      });
    }

    const resend = new Resend(apiKey);

    const emailSubject = safeSubject || "Nova mensagem EscalaX";
    const replyTo = safeEmail && safeEmail.includes("@") ? safeEmail : undefined;

    const html = `
    <h2>Nova mensagem de suporte</h2>
    <p><b>Nome:</b> ${escapeHtml(safeName)}</p>
    <p><b>Email:</b> ${escapeHtml(safeEmail || "Não informado")}</p>
    <p><b>Categoria:</b> ${escapeHtml(categoryLabel)}</p>
    <p><b>Mensagem:</b></p>
    <p>${escapeHtml(message).replace(/\r\n/g, "<br/>").replace(/\n/g, "<br/>")}</p>
  `;

    try {
      logStructured({ step: "resend.send.begin", to: supportTo, hasReplyTo: !!replyTo });

      const { error: sendErr } = await resend.emails.send({
        from: "EscalaX <support@escalax.app.br>",
        to: [supportTo],
        subject: emailSubject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      });

      if (sendErr) {
        const errMsg =
          typeof sendErr === "object" && sendErr !== null && "message" in sendErr
            ? String((sendErr as { message: string }).message)
            : String(sendErr);
        logStructured({ step: "resend.send.error", message: errMsg.slice(0, 300) });
        throw new Error(errMsg || "Resend error");
      }

      logStructured({ step: "resend.send.ok" });
      await serviceClient.from("feedback_messages").update({ status: "sent" }).eq("id", feedback.id);
      return json({ outcome: "email_sent", sent: true, stored: true });
    } catch (emailErr) {
      const raw = getErrorMessage(emailErr);
      logStructured({ step: "resend.send.failed", message: raw.slice(0, 500) });

      await serviceClient.from("feedback_messages").update({ status: "email_failed" }).eq("id", feedback.id);
      return json({
        outcome: "saved_email_failed",
        sent: false,
        stored: true,
        error:
          "Mensagem salva, mas houve falha no envio do e-mail. Nossa equipe ainda poderá analisar a solicitação.",
      });
    }
  } catch (err) {
    const technicalError = getErrorMessage(err);
    logStructured({ step: "fatal", message: technicalError.slice(0, 500) });
    return json(
      {
        outcome: "internal_error",
        sent: false,
        stored: false,
        error: "Não foi possível processar sua solicitação. Tente novamente.",
      },
      500,
    );
  }
});
