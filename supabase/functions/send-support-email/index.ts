import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPPORT_EMAIL = "support@escalax.app.br";

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
      console.error("feedback insert failed", insertError);
      return json({ sent: false, stored: false, error: "Não foi possível registrar sua solicitação." }, 500);
    }

    // ── Attempt email via Lovable Email API ──────────────
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    
    // Try multiple possible email API URLs
    const emailApiUrl = Deno.env.get("LOVABLE_EMAIL_API_URL") 
      || "https://email.lovable.dev/v1/send";

    if (!apiKey) {
      console.warn("LOVABLE_API_KEY not configured — message stored only");
      await serviceClient.from("feedback_messages").update({ status: "stored_no_email_key" }).eq("id", feedback.id);
      return json({ sent: false, stored: true, error: "E-mail não configurado. Mensagem salva no sistema." });
    }

    const categoryLabel = categoryToLabel(safeType);
    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const emailBody = [
      `Nova mensagem de feedback do EscalaX`,
      ``,
      `Categoria: ${categoryLabel}`,
      `Nome: ${safeName}`,
      `E-mail: ${safeEmail || "Não informado"}`,
      `Assunto: ${safeSubject || "Sem assunto"}`,
      `Rota: ${route || "/"}`,
      `Data/Hora: ${now}`,
      `ID Feedback: ${feedback.id}`,
      ``,
      `Mensagem:`,
      message,
    ].join("\n");

    try {
      console.log(`Attempting email send to ${SUPPORT_EMAIL} via ${emailApiUrl}`);
      
      const res = await fetch(emailApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          to: [SUPPORT_EMAIL],
          subject: `[EscalaX] ${categoryLabel} - ${safeName}`,
          text: emailBody,
          html: `<pre style="font-family: sans-serif; white-space: pre-wrap;">${emailBody.replace(/</g, '&lt;')}</pre>`,
          replyTo: safeEmail || undefined,
        }),
      });

      const resText = await res.text();
      console.log(`Email API response: ${res.status} - ${resText}`);

      if (res.ok) {
        await serviceClient.from("feedback_messages").update({ status: "sent" }).eq("id", feedback.id);
        return json({ sent: true, stored: true });
      }

      console.warn("Email delivery failed", res.status, resText);
      await serviceClient.from("feedback_messages").update({ status: "email_failed" }).eq("id", feedback.id);
      return json({ sent: false, stored: true, error: `E-mail falhou (${res.status}). Mensagem salva no sistema.` });
    } catch (emailErr) {
      console.error("Email delivery error", emailErr);
      await serviceClient.from("feedback_messages").update({ status: "email_failed" }).eq("id", feedback.id);
      return json({ sent: false, stored: true, error: "Falha ao enviar e-mail. Mensagem salva no sistema." });
    }
  } catch (err) {
    console.error("send-support-email fatal", err);
    return json({ sent: false, stored: false, error: "Erro interno" }, 500);
  }
});