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
    return "Erro SMTP desconhecido";
  }
}

async function drainResponse(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
): Promise<string> {
  let full = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    const lines = full.split("\r\n").filter(Boolean);
    const lastLine = lines[lines.length - 1] || "";
    if (/^\d{3} /.test(lastLine)) break;
  }
  return full.trim();
}

async function sendCommand(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  encoder: TextEncoder,
  cmd: string,
): Promise<string> {
  await writer.write(encoder.encode(cmd + "\r\n"));
  return drainResponse(reader, decoder);
}

async function authenticateSmtp(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  encoder: TextEncoder,
  username: string,
  password: string,
) {
  const loginResp = await sendCommand(writer, reader, decoder, encoder, "AUTH LOGIN");
  if (loginResp.startsWith("334")) {
    const userResp = await sendCommand(writer, reader, decoder, encoder, btoa(username));
    if (!userResp.startsWith("334")) {
      throw new Error(`AUTH LOGIN usuário rejeitado: ${userResp}`);
    }

    const passResp = await sendCommand(writer, reader, decoder, encoder, btoa(password));
    if (passResp.startsWith("235")) return;
    throw new Error(`AUTH LOGIN senha rejeitada: ${passResp}`);
  }

  const credentials = btoa(`\x00${username}\x00${password}`);
  const plainResp = await sendCommand(writer, reader, decoder, encoder, `AUTH PLAIN ${credentials}`);
  if (!plainResp.startsWith("235")) {
    throw new Error(`AUTH SMTP falhou. LOGIN: ${loginResp} | PLAIN: ${plainResp}`);
  }
}

async function sendSmtpEmail(options: {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}) {
  const { host, port, username, password, from, to, subject, html } = options;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  console.log(`[SMTP] Connecting to ${host}:${port}`);

  const conn = await Deno.connect({ hostname: host, port });
  let reader = conn.readable.getReader();
  let writer = conn.writable.getWriter();

  const greeting = await drainResponse(reader, decoder);
  if (!greeting.startsWith("220")) throw new Error(`SMTP greeting inválido: ${greeting}`);

  const ehlo = await sendCommand(writer, reader, decoder, encoder, "EHLO escalax.app.br");
  if (!ehlo.startsWith("250")) throw new Error(`EHLO falhou: ${ehlo}`);

  const startTls = await sendCommand(writer, reader, decoder, encoder, "STARTTLS");
  if (!startTls.startsWith("220")) throw new Error(`STARTTLS falhou: ${startTls}`);

  reader.releaseLock();
  writer.releaseLock();

  const tlsConn = await Deno.startTls(conn, { hostname: host });
  reader = tlsConn.readable.getReader();
  writer = tlsConn.writable.getWriter();

  const tlsEhlo = await sendCommand(writer, reader, decoder, encoder, "EHLO escalax.app.br");
  if (!tlsEhlo.startsWith("250")) throw new Error(`EHLO pós-TLS falhou: ${tlsEhlo}`);

  await authenticateSmtp(writer, reader, decoder, encoder, username, password);

  const mailFrom = await sendCommand(writer, reader, decoder, encoder, `MAIL FROM:<${from}>`);
  if (!mailFrom.startsWith("250")) throw new Error(`MAIL FROM rejeitado: ${mailFrom}`);

  const rcptTo = await sendCommand(writer, reader, decoder, encoder, `RCPT TO:<${to}>`);
  if (!rcptTo.startsWith("250")) throw new Error(`RCPT TO rejeitado: ${rcptTo}`);

  const dataResp = await sendCommand(writer, reader, decoder, encoder, "DATA");
  if (!dataResp.startsWith("354")) throw new Error(`DATA falhou: ${dataResp}`);

  const boundary = `----=_Part_${Date.now()}`;
  const message = [
    `From: EscalaX Support <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary=\"${boundary}\"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    html,
    "",
    `--${boundary}--`,
    ".",
  ].join("\r\n");

  const endResp = await sendCommand(writer, reader, decoder, encoder, message);
  if (!endResp.startsWith("250")) throw new Error(`Mensagem rejeitada: ${endResp}`);

  await sendCommand(writer, reader, decoder, encoder, "QUIT");

  reader.releaseLock();
  writer.releaseLock();
  tlsConn.close();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ sent: false, stored: false, error: "Não autorizado" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return json({ sent: false, stored: false, error: "Não autorizado" }, 401);
    }

    const { name, email, type, subject, message, route } = await req.json();
    if (!message?.trim()) {
      return json({ sent: false, stored: false, error: "Mensagem é obrigatória" }, 400);
    }

    const safeName = name?.trim() || "Usuário";
    const safeType = type?.trim() || "contact";
    const safeSubject = subject?.trim() || null;
    const safeEmail = email?.trim() || null;

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
      return json({ sent: false, stored: false, error: "Não foi possível registrar." }, 500);
    }

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587", 10);
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const toEmail = Deno.env.get("SUPPORT_TO_EMAIL") || "support@escalax.app.br";
    const fromEmail = Deno.env.get("SUPPORT_FROM_EMAIL") || smtpUser || "support@escalax.app.br";

    if (!smtpHost || !smtpUser || !smtpPass) {
      await serviceClient.from("feedback_messages").update({ status: "stored_no_email" }).eq("id", feedback.id);
      return json({
        sent: false,
        stored: true,
        error: "Configuração SMTP incompleta.",
        technicalError: "Secrets SMTP ausentes ou inválidos.",
      });
    }

    const categoryLabel = categoryToLabel(safeType);
    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const emailHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#2563EB;padding:24px;border-radius:12px 12px 0 0">
    <h1 style="color:#fff;margin:0;font-size:18px">✈️ EscalaX — ${categoryLabel}</h1>
  </div>
  <div style="background:#f8f9fa;padding:24px;border-radius:0 0 12px 12px">
    <table style="width:100%;font-size:14px;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:#666">Nome:</td><td style="padding:6px 0;font-weight:600">${safeName}</td></tr>
      <tr><td style="padding:6px 0;color:#666">E-mail:</td><td style="padding:6px 0">${safeEmail || "Não informado"}</td></tr>
      <tr><td style="padding:6px 0;color:#666">Categoria:</td><td style="padding:6px 0">${categoryLabel}</td></tr>
      <tr><td style="padding:6px 0;color:#666">Assunto:</td><td style="padding:6px 0">${safeSubject || "Sem assunto"}</td></tr>
      <tr><td style="padding:6px 0;color:#666">Rota:</td><td style="padding:6px 0;font-family:monospace">${route || "/"}</td></tr>
      <tr><td style="padding:6px 0;color:#666">Data/Hora:</td><td style="padding:6px 0">${now}</td></tr>
      <tr><td style="padding:6px 0;color:#666">ID:</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${feedback.id}</td></tr>
    </table>
    <hr style="margin:16px 0;border:0;border-top:1px solid #ddd"/>
    <p style="font-size:14px;color:#333;white-space:pre-wrap">${message.replace(/</g, "&lt;")}</p>
  </div>
</div>`;

    try {
      await sendSmtpEmail({
        host: smtpHost,
        port: smtpPort,
        username: smtpUser,
        password: smtpPass,
        from: fromEmail,
        to: toEmail,
        subject: `[EscalaX] ${categoryLabel} — ${safeName}`,
        html: emailHtml,
      });

      await serviceClient.from("feedback_messages").update({ status: "sent" }).eq("id", feedback.id);
      return json({ sent: true, stored: true });
    } catch (emailErr) {
      const technicalError = getErrorMessage(emailErr);
      console.error("[send-support-email] SMTP error:", technicalError);
      await serviceClient.from("feedback_messages").update({ status: "email_failed" }).eq("id", feedback.id);
      return json({
        sent: false,
        stored: true,
        error: "Mensagem registrada, mas o e-mail não foi entregue.",
        technicalError,
      });
    }
  } catch (err) {
    const technicalError = getErrorMessage(err);
    console.error("[send-support-email] fatal:", technicalError);
    return json({ sent: false, stored: false, error: "Erro interno", technicalError }, 500);
  }
});