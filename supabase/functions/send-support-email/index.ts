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

// ── SMTP helpers using raw Deno TCP + STARTTLS ──

async function readLine(reader: ReadableStreamDefaultReader<Uint8Array>, decoder: TextDecoder): Promise<string> {
  let line = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    line += decoder.decode(value, { stream: true });
    if (line.includes("\r\n")) break;
  }
  return line.trim();
}

async function drainResponse(reader: ReadableStreamDefaultReader<Uint8Array>, decoder: TextDecoder): Promise<string> {
  // Read all available response lines (multi-line responses end with "XXX " not "XXX-")
  let full = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    // Check if last line is a final response (3-digit code followed by space)
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
  cmd: string
): Promise<string> {
  await writer.write(encoder.encode(cmd + "\r\n"));
  return drainResponse(reader, decoder);
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

  // 1. Connect plain TCP
  const conn = await Deno.connect({ hostname: host, port });
  let reader = conn.readable.getReader();
  let writer = conn.writable.getWriter();

  // Read greeting
  const greeting = await drainResponse(reader, decoder);
  console.log(`[SMTP] Greeting: ${greeting.substring(0, 80)}`);
  if (!greeting.startsWith("220")) throw new Error(`Bad greeting: ${greeting}`);

  // EHLO
  let ehlo = await sendCommand(writer, reader, decoder, encoder, `EHLO escalax.app.br`);
  console.log(`[SMTP] EHLO response received`);

  // STARTTLS
  const starttls = await sendCommand(writer, reader, decoder, encoder, "STARTTLS");
  console.log(`[SMTP] STARTTLS: ${starttls.substring(0, 40)}`);
  if (!starttls.startsWith("220")) throw new Error(`STARTTLS failed: ${starttls}`);

  // Release plain readers/writers before TLS upgrade
  reader.releaseLock();
  writer.releaseLock();

  // Upgrade to TLS
  const tlsConn = await Deno.startTls(conn, { hostname: host });
  reader = tlsConn.readable.getReader();
  writer = tlsConn.writable.getWriter();

  // EHLO again over TLS
  ehlo = await sendCommand(writer, reader, decoder, encoder, `EHLO escalax.app.br`);
  console.log(`[SMTP] TLS EHLO OK`);

  // AUTH LOGIN
  const authResp = await sendCommand(writer, reader, decoder, encoder, "AUTH LOGIN");
  if (!authResp.startsWith("334")) throw new Error(`AUTH failed: ${authResp}`);

  const userResp = await sendCommand(writer, reader, decoder, encoder, btoa(username));
  if (!userResp.startsWith("334")) throw new Error(`AUTH user failed: ${userResp}`);

  const passResp = await sendCommand(writer, reader, decoder, encoder, btoa(password));
  if (!passResp.startsWith("235")) throw new Error(`AUTH pass failed: ${passResp}`);
  console.log(`[SMTP] Authenticated`);

  // MAIL FROM
  const mailFrom = await sendCommand(writer, reader, decoder, encoder, `MAIL FROM:<${from}>`);
  if (!mailFrom.startsWith("250")) throw new Error(`MAIL FROM failed: ${mailFrom}`);

  // RCPT TO
  const rcptTo = await sendCommand(writer, reader, decoder, encoder, `RCPT TO:<${to}>`);
  if (!rcptTo.startsWith("250")) throw new Error(`RCPT TO failed: ${rcptTo}`);

  // DATA
  const dataResp = await sendCommand(writer, reader, decoder, encoder, "DATA");
  if (!dataResp.startsWith("354")) throw new Error(`DATA failed: ${dataResp}`);

  // Build message
  const boundary = `----=_Part_${Date.now()}`;
  const msg = [
    `From: EscalaX Support <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    html,
    ``,
    `--${boundary}--`,
    `.`,
  ].join("\r\n");

  const endResp = await sendCommand(writer, reader, decoder, encoder, msg);
  if (!endResp.startsWith("250")) throw new Error(`Send failed: ${endResp}`);
  console.log(`[SMTP] Message accepted`);

  // QUIT
  await sendCommand(writer, reader, decoder, encoder, "QUIT");

  try {
    reader.releaseLock();
    writer.releaseLock();
    tlsConn.close();
  } catch { /* ignore close errors */ }
}

// ── Main handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ sent: false, stored: false, error: "Não autorizado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ sent: false, stored: false, error: "Não autorizado" }, 401);

    // Payload
    const { name, email, type, subject, message, route } = await req.json();
    if (!message?.trim()) return json({ sent: false, stored: false, error: "Mensagem é obrigatória" }, 400);

    const safeName = name?.trim() || "Usuário";
    const safeType = type?.trim() || "contact";
    const safeSubject = subject?.trim() || null;
    const safeEmail = email?.trim() || null;

    // Persist first
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

    // SMTP Config
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587", 10);
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const toEmail = Deno.env.get("SUPPORT_TO_EMAIL") || "support@escalax.app.br";
    const fromEmail = Deno.env.get("SUPPORT_FROM_EMAIL") || smtpUser || "noreply@escalax.app.br";

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.warn("[send-support-email] SMTP not configured — stored only");
      await serviceClient.from("feedback_messages").update({ status: "stored_no_email" }).eq("id", feedback.id);
      return json({ sent: false, stored: true, error: "Mensagem salva. Envio por e-mail pendente de configuração." });
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

      console.log("[send-support-email] Email sent successfully");
      await serviceClient.from("feedback_messages").update({ status: "sent" }).eq("id", feedback.id);
      return json({ sent: true, stored: true });

    } catch (emailErr) {
      console.error("[send-support-email] SMTP error:", emailErr);
      await serviceClient.from("feedback_messages").update({ status: "email_failed" }).eq("id", feedback.id);
      return json({ sent: false, stored: true, error: "Mensagem salva. Falha no envio do e-mail." });
    }

  } catch (err) {
    console.error("[send-support-email] fatal:", err);
    return json({ sent: false, stored: false, error: "Erro interno" }, 500);
  }
});
