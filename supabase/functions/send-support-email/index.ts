import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPPORT_EMAIL = "support@escalax.app.br";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { name, email, type, subject, message, route } = await req.json();

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: "Mensagem é obrigatória" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const categoryLabel =
      type === "suggestion" ? "Sugerir melhoria" :
      type === "bug" ? "Relatar problema" : "Entrar em contato";

    const emailSubject = `[EscalaX] ${categoryLabel} - ${name || "Usuário"}`;
    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const emailBody = `
Nova mensagem de feedback do EscalaX

Categoria: ${categoryLabel}
Nome: ${name || "Não informado"}
E-mail: ${email || "Não informado"}
Assunto: ${subject || "Sem assunto"}
Rota: ${route || "/"}
Data/Hora: ${now}

Mensagem:
${message}
`.trim();

    // Save to database
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await serviceClient.from("feedback_messages").insert({
      user_id: user.id,
      type,
      subject: subject || null,
      message,
      email: email || null,
      route: route || null,
      status: "pending",
    });

    // Send email via Lovable API
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (lovableApiKey) {
      const res = await fetch("https://email.lovable.dev/v1/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          to: [SUPPORT_EMAIL],
          subject: emailSubject,
          text: emailBody,
          replyTo: email || undefined,
        }),
      });

      if (!res.ok) {
        console.error("Email send failed:", await res.text());
        return new Response(
          JSON.stringify({ sent: false, fallback: true, subject: emailSubject, body: emailBody }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ sent: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No API key - return fallback data for mailto
    return new Response(
      JSON.stringify({ sent: false, fallback: true, subject: emailSubject, body: emailBody }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
