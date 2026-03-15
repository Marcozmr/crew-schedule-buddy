import { supabase } from '@/integrations/supabase/client';
import { detectAirline, parseMockSchedule } from '@/lib/store';

type GmailListResponse = {
  messages?: Array<{ id: string }>;
};

type GmailMessageResponse = {
  id: string;
  snippet?: string;
  payload?: GmailPayload;
};

type GmailPayload = {
  mimeType?: string;
  filename?: string;
  body?: {
    data?: string;
    attachmentId?: string;
  };
  parts?: GmailPayload[];
};

type ImportScheduleResult = {
  importedCount: number;
  parsedCount: number;
  airline: string;
  reason?: string;
};

const GMAIL_SCOPE_ERROR = 'GMAIL_SCOPE_MISSING';

function decodeBase64Url(input?: string): string {
  if (!input) return '';

  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '==='.slice((normalized.length + 3) % 4);

  try {
    return decodeURIComponent(
      Array.prototype.map
        .call(atob(padded), (char: string) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('')
    );
  } catch {
    return atob(padded);
  }
}

function stripHtmlTags(input: string): string {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

async function gmailFetch<T>(providerToken: string, url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${providerToken}`,
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(GMAIL_SCOPE_ERROR);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro Gmail (${response.status}): ${text}`);
  }

  return (await response.json()) as T;
}

async function fetchAttachmentText(
  providerToken: string,
  messageId: string,
  attachmentId: string,
  mimeType: string,
  filename: string
): Promise<string> {
  const isTextAttachment =
    mimeType.startsWith('text/') ||
    ['application/csv', 'application/vnd.ms-excel'].includes(mimeType) ||
    /\.(txt|csv)$/i.test(filename);

  if (!isTextAttachment) return '';

  const attachment = await gmailFetch<{ data?: string }>(
    providerToken,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`
  );

  return decodeBase64Url(attachment.data);
}

async function extractPayloadText(
  providerToken: string,
  messageId: string,
  payload?: GmailPayload
): Promise<string[]> {
  if (!payload) return [];

  const texts: string[] = [];
  const mimeType = payload.mimeType ?? '';
  const filename = payload.filename ?? '';
  const bodyData = payload.body?.data;
  const attachmentId = payload.body?.attachmentId;

  if (bodyData) {
    const decoded = decodeBase64Url(bodyData);
    if (decoded) {
      texts.push(mimeType.includes('html') ? stripHtmlTags(decoded) : decoded);
    }
  }

  if (attachmentId) {
    const attachmentText = await fetchAttachmentText(providerToken, messageId, attachmentId, mimeType, filename);
    if (attachmentText) {
      texts.push(mimeType.includes('html') ? stripHtmlTags(attachmentText) : attachmentText);
    }
  }

  if (payload.parts?.length) {
    for (const part of payload.parts) {
      const nested = await extractPayloadText(providerToken, messageId, part);
      texts.push(...nested);
    }
  }

  return texts;
}

async function fetchBestScheduleText(providerToken: string): Promise<{ text: string; parsedCount: number }> {
  const queries = [
    'newer_than:180d (subject:escala OR subject:roster OR subject:pairing OR "escala de voo" OR "tripulante")',
    'newer_than:180d has:attachment (escala OR roster OR pairing)',
  ];

  let bestText = '';
  let bestCount = 0;

  for (const query of queries) {
    const list = await gmailFetch<GmailListResponse>(
      providerToken,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${encodeURIComponent(query)}`
    );

    const messageIds = list.messages?.map((message) => message.id) ?? [];

    for (const messageId of messageIds) {
      const message = await gmailFetch<GmailMessageResponse>(
        providerToken,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`
      );

      const parts = await extractPayloadText(providerToken, message.id, message.payload);
      const combinedText = [message.snippet ?? '', ...parts].join('\n').trim();
      if (!combinedText) continue;

      const parsed = parseMockSchedule(combinedText);
      if (parsed.length > bestCount) {
        bestCount = parsed.length;
        bestText = combinedText;
      }
    }

    if (bestCount > 0) break;
  }

  return { text: bestText, parsedCount: bestCount };
}

export async function importScheduleFromGmail(
  userId: string,
  providerToken: string
): Promise<ImportScheduleResult> {
  const { text, parsedCount } = await fetchBestScheduleText(providerToken);

  if (!text || parsedCount === 0) {
    return {
      importedCount: 0,
      parsedCount: 0,
      airline: 'Não identificada',
      reason: 'Nenhuma escala reconhecida nos e-mails recentes.',
    };
  }

  const parsedEntries = parseMockSchedule(text);
  const airline = detectAirline(text);

  const { data: existingRows } = await supabase
    .from('schedule_entries')
    .select('date, flight_number')
    .eq('user_id', userId);

  const existingKeys = new Set((existingRows ?? []).map((row) => `${row.date}|${row.flight_number}`));

  const rows = parsedEntries
    .map((entry) => ({
      user_id: userId,
      date: entry.date,
      flight_number: entry.flightNumber,
      departure: entry.departure,
      arrival: entry.arrival,
      departure_time: entry.departureTime,
      arrival_time: entry.arrivalTime,
      status: entry.status,
      airline: entry.airline,
      report_time: entry.reportTime || null,
      duty_hours: entry.dutyHours || null,
    }))
    .filter((row) => !existingKeys.has(`${row.date}|${row.flight_number}`));

  if (rows.length > 0) {
    const { error } = await supabase.from('schedule_entries').insert(rows);
    if (error) {
      throw new Error('Não foi possível salvar a escala importada no banco de dados.');
    }
  }

  if (airline !== 'Não identificada') {
    await supabase.from('profiles').update({ airline }).eq('user_id', userId);
  }

  return {
    importedCount: rows.length,
    parsedCount,
    airline,
  };
}

export function isGmailScopeError(error: unknown): boolean {
  return error instanceof Error && error.message === GMAIL_SCOPE_ERROR;
}
