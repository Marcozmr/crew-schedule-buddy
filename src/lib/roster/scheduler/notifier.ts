import fs from 'node:fs/promises'
import nodemailer from 'nodemailer'
import type { RosterJson } from '../types.ts'

interface NotifyParams {
  pdfPath: string
  roster: RosterJson
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`)
  }
  return value
}

export async function sendRosterNotification(params: NotifyParams): Promise<void> {
  const host = readRequiredEnv('SMTP_HOST')
  const port = Number.parseInt(readRequiredEnv('SMTP_PORT'), 10)
  const user = readRequiredEnv('SMTP_USER')
  const pass = readRequiredEnv('SMTP_PASS')
  const to = readRequiredEnv('NOTIFY_EMAIL')

  if (Number.isNaN(port)) {
    throw new Error('SMTP_PORT inválido.')
  }

  const pdfContent = await fs.readFile(params.pdfPath)

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  await transporter.sendMail({
    from: `"EscalaX" <${user}>`,
    to,
    subject: 'EscalaX: escala atualizada',
    text: [
      'A escala foi atualizada e sincronizada automaticamente.',
      `Voos: ${params.roster.flights.length}`,
      `Folgas/Reservas: ${params.roster.daysOff.length}`,
    ].join('\n'),
    attachments: [
      {
        filename: params.pdfPath.split(/[\\/]/).pop() ?? 'escala.pdf',
        content: pdfContent,
        contentType: 'application/pdf',
      },
    ],
  })

  console.log(`📧 ✅ Notificação enviada para ${to}.`)
}
