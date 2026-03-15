import { supabase } from '@/integrations/supabase/client';
import { detectAirline, parseMockSchedule } from '@/lib/store';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

type GmailListResponse = {
  messages?: Array<{ id: string }>;
};

type GmailMessageResponse = {
  id: string;
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
const TARGET_FILENAME = 'CrewRosterReport.pdf';

async function gmailFetch<T>(providerToken: string, url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${providerToken}` },
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

function decodeBase64UrlToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '==='.slice((normalized.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
  const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const textParts: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .filter((item): item is { str: string } & Record<string, unknown> => 'str' in item)
      .map((item) => item.str)
      .join(' ');
    textParts.push(pageText);
  }

  return textParts.join('\n');
}

function findAttachmentInPayload(
  payload: GmailPayload | undefined,
  targetFilename: string
): { attachmentId: string } | null {
  if (!payload) return null;

  if (
    payload.filename?.toLowerCase() === targetFilename.toLowerCase() &&
    payload.body?.attachmentId
  ) {
    return { attachmentId: payload.body.attachmentId };
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const found = findAttachmentInPayload(part, targetFilename);
      if (found) return found;
    }
  }

  return null;
}

async function fetchCrewRosterPdf(providerToken: string): Promise<{ text: string; parsedCount: number }> {
  const query = `newer_than:180d has:attachment filename:${TARGET_FILENAME}`;

  const list = await gmailFetch<GmailListResponse>(
    providerToken,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=${encodeURIComponent(query)}`
  );

  const messageIds = list.messages?.map((m) => m.id) ?? [];

  if (messageIds.length === 0) {
    return { text: '', parsedCount: 0 };
  }

  let bestText = '';
  let bestCount = 0;

  for (const messageId of messageIds) {
    const message = await gmailFetch<GmailMessageResponse>(
      providerToken,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`
    );

    const attachmentInfo = findAttachmentInPayload(message.payload, TARGET_FILENAME);
    if (!attachmentInfo) continue;

    const attachment = await gmailFetch<{ data?: string }>(
      providerToken,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentInfo.attachmentId}`
    );

    if (!attachment.data) continue;

    const pdfBytes = decodeBase64UrlToBytes(attachment.data);
    const text = await extractTextFromPdf(pdfBytes);

    const parsed = parseMockSchedule(text);
    if (parsed.length > bestCount) {
      bestCount = parsed.length;
      bestText = text;
    }

    // If we found entries, use the most recent email (first result)
    if (bestCount > 0) break;
  }

  return { text: bestText, parsedCount: bestCount };
}

export async function importScheduleFromGmail(
  userId: string,
  providerToken: string
): Promise<ImportScheduleResult> {
  const { text, parsedCount } = await fetchCrewRosterPdf(providerToken);

  if (!text || parsedCount === 0) {
    return {
      importedCount: 0,
      parsedCount: 0,
      airline: 'Não identificada',
      reason: `Nenhum arquivo "${TARGET_FILENAME}" encontrado nos e-mails recentes ou não foi possível extrair dados de voo dele.`,
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
