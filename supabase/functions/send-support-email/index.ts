import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const categoryToLabel = (type: string | null | undefined) =>
  type === "suggestion" ? "Sugerir melhoria"
    : type === "bug" ? "Relatar problema"
    : "Entrar em contato";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ sent: false, stored: false, error: "Não autorizado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ sent: false, stored: false, error: "Não autorizado" }, 401);

    // ── Payload ──────────────────────────────────────────
    const { name, email, type, subject, message, route } = await req.json();
    if (!message?.trim()) return json({ sent: false, stored: false, error: "Mensagem é obrigatória" }, 400);

    const safeName = name?.trim() || "Usuário";
    const safeType = type?.trim() || "contact";
    const safeSubject = subject?.trim() || null;
    const safeEmail = email?.trim() || null;

    // ── Persist first (source of truth) ──────────────────
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
      console.error("[send-support-email] insert failed:", insertError);
      return json({ sent: false, stored: false, error: "Não foi possível registrar sua solicitação." }, 500);
    }

    // ── Attempt email via Resend API ─────────────────────
    // Requires secrets: RESEND_API_KEY, SUPPORT_TO_EMAIL, SUPPORT_FROM_EMAIL
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const toEmail = Deno.env.get("SUPPORT_TO_EMAIL") || "support@escalax.app.br";
    const fromEmail = Deno.env.get("SUPPORT_FROM_EMAIL") || "noreply@escalax.app.br";

    if (!resendKey) {
      console.warn("[send-support-email] RESEND_API_KEY not configured — stored only");
      await serviceClient.from("feedback_messages").update({ status: "stored_no_email" }).eq("id", feedback.id);
      return json({
        sent: false,
        stored: true,
        error: "Mensagem salva com sucesso. Envio de e-mail pendente de configuração.",
      });
    }

    const categoryLabel = categoryToLabel(safeType);
    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const emailHtml = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #1a1f36; padding: 24px; border-radius: 12px 12px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 18px;">✈️ EscalaX — ${categoryLabel}</h1>
  </div>
  <div style="background: #f8f9fa; padding: 24px; border-radius: 0 0 12px 12px;">
    <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
      <tr><td style="padding: 6px 0; color: #666;">Nome:</td><td style="padding: 6px 0; font-weight: 600;">${safeName}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">E-mail:</td><td style="padding: 6px 0;">${safeEmail || "Não informado"}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">Categoria:</td><td style="padding: 6px 0;">${categoryLabel}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">Assunto:</td><td style="padding: 6px 0;">${safeSubject || "Sem assunto"}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">Rota:</td><td style="padding: 6px 0; font-family: monospace;">${route || "/"}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">Data/Hora:</td><td style="padding: 6px 0;">${now}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">ID:</td><td style="padding: 6px 0; font-family: monospace; font-size: 12px;">${feedback.id}</td></tr>
    </table>
    <hr style="margin: 16px 0; border: 0; border-top: 1px solid #ddd;" />
    <p style="font-size: 14px; color: #333; white-space: pre-wrap;">${message.replace(/</g, "&lt;")}</p>
  </div>
</div>`;

    try {
      console.log(`[send-support-email] Sending via Resend to ${toEmail}`);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject: `[EscalaX] ${categoryLabel} — ${safeName}`,
          html: emailHtml,
          reply_to: safeEmail || undefined,
        }),
      });

      const resText = await res.text();
      console.log(`[send-support-email] Resend response: ${res.status} — ${resText.substring(0, 200)}`);

      if (res.ok) {
        await serviceClient.from("feedback_messages").update({ status: "sent" }).eq("id", feedback.id);
        return json({ sent: true, stored: true });
      }

      // Email failed but message is stored
      console.error(`[send-support-email] Resend error: ${res.status}`);
      await serviceClient.from("feedback_messages").update({ status: "email_failed" }).eq("id", feedback.id);
      return json({
        sent: false,
        stored: true,
        error: `Mensagem salva. Falha no envio do e-mail (${res.status}).`,
      });
    } catch (emailErr) {
      console.error("[send-support-email] email send error:", emailErr);
      await serviceClient.from("feedback_messages").update({ status: "email_error" }).eq("id", feedback.id);
      return json({
        sent: false,
        stored: true,
        error: "Mensagem salva. Erro ao enviar e-mail.",
      });
    }
  } catch (err) {
    console.error("[send-support-email] fatal:", err);
    return json({ sent: false, stored: false, error: "Erro interno" }, 500);
  }
});
