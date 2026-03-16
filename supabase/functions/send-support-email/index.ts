import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPPORT_EMAIL = "support@escalax.app.br";
const EMAIL_API_URL = Deno.env.get("LOVABLE_EMAIL_API_URL") || "https://email.lovable.dev/v1/send";
const GENERIC_SEND_ERROR = "Não foi possível enviar sua mensagem agora. Tente novamente em instantes.";

const jsonResponse = (payload: unknown, status = 200) =>
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ sent: false, error: "Não autorizado" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ sent: false, error: "Não autorizado" }, 401);
    }

    const { name, email, type, subject, message, route } = await req.json();

    if (!message?.trim()) {
      return jsonResponse({ sent: false, error: "Mensagem é obrigatória" }, 400);
    }

    const categoryLabel = categoryToLabel(type);
    const safeName = name?.trim() || "Usuário";
    const safeType = type?.trim() || "contact";
    const safeSubject = subject?.trim() || null;
    const safeEmail = email?.trim() || null;
    const now = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });

    const emailSubject = `[EscalaX] ${categoryLabel} - ${safeName}`;
    const emailBody = `
Nova mensagem de feedback do EscalaX

Categoria: ${categoryLabel}
Nome: ${safeName}
E-mail: ${safeEmail || "Não informado"}
Assunto: ${safeSubject || "Sem assunto"}
Rota: ${route || "/"}
Data/Hora: ${now}

Mensagem:
${message}
`.trim();

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: createdFeedback, error: insertError } = await serviceClient
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

    if (insertError || !createdFeedback) {
      console.error("feedback_messages insert failed", insertError);
      return jsonResponse({ sent: false, error: "Não foi possível registrar sua solicitação." }, 500);
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      await serviceClient.from("feedback_messages").update({ status: "failed" }).eq("id", createdFeedback.id);
      console.error("LOVABLE_API_KEY não configurada");
      return jsonResponse({ sent: false, stored: true, error: GENERIC_SEND_ERROR }, 503);
    }

    const providerResponse = await fetch(EMAIL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        to: [SUPPORT_EMAIL],
        subject: emailSubject,
        text: emailBody,
        replyTo: safeEmail || undefined,
      }),
    });

    if (!providerResponse.ok) {
      const providerErrorBody = await providerResponse.text();
      console.error("Email provider request failed", {
        status: providerResponse.status,
        body: providerErrorBody,
      });

      await serviceClient.from("feedback_messages").update({ status: "failed" }).eq("id", createdFeedback.id);

      return jsonResponse({ sent: false, stored: true, error: GENERIC_SEND_ERROR }, 502);
    }

    await serviceClient.from("feedback_messages").update({ status: "sent" }).eq("id", createdFeedback.id);

    return jsonResponse({ sent: true, stored: true });
  } catch (err) {
    console.error("send-support-email fatal error", err);
    return jsonResponse({ sent: false, error: "Erro interno" }, 500);
  }
});
