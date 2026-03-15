import { supabase } from '@/integrations/supabase/client';
import { detectAirline, parseMockSchedule } from '@/lib/store';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

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

type AttachmentMatch = {
  attachmentId: string;
  filename: string;
};

type PdfFetchResult = {
  text: string;
  parsedCount: number;
  foundPdf: boolean;
};

const GMAIL_SCOPE_ERROR = 'GMAIL_SCOPE_MISSING';
const TARGET_FILENAME = 'CrewRosterReport.pdf';
const TARGET_FILENAME_NORMALIZED = normalizeFilename(TARGET_FILENAME);

function normalizeFilename(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '').replace(/["']/g, '');
}

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
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ')
      .trim();

    if (pageText) {
      textParts.push(pageText);
    }
  }

  return textParts.join('\n');
}

function findCrewRosterAttachment(payload?: GmailPayload): AttachmentMatch | null {
  if (!payload) return null;

  const filename = payload.filename ?? '';
  const attachmentId = payload.body?.attachmentId;
  if (attachmentId && normalizeFilename(filename) === TARGET_FILENAME_NORMALIZED) {
    return { attachmentId, filename: payload.filename ?? TARGET_FILENAME };
  }

  if (!payload.parts?.length) return null;

  for (const part of payload.parts) {
    const found = findCrewRosterAttachment(part);
    if (found) return found;
  }

  return null;
}

async function listCandidateMessageIds(providerToken: string): Promise<string[]> {
  const queries = [
    `has:attachment filename:"${TARGET_FILENAME}"`,
    `has:attachment ${TARGET_FILENAME}`,
    'has:attachment newer_than:3650d',
  ];

  const idSet = new Set<string>();

  for (const query of queries) {
    const list = await gmailFetch<GmailListResponse>(
      providerToken,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=30&q=${encodeURIComponent(query)}`
    );

    (list.messages ?? []).forEach((message) => idSet.add(message.id));

    if (idSet.size >= 60) break;
  }

  return Array.from(idSet);
}

async function savePdfIntoApp(userId: string, sourceMessageId: string, pdfBytes: Uint8Array): Promise<void> {
  const storagePath = `${userId}/${TARGET_FILENAME}`;
  const safeBytes = Uint8Array.from(pdfBytes);
  const pdfBlob = new Blob([safeBytes.buffer], { type: 'application/pdf' });

  const { error: uploadError } = await supabase.storage
    .from('crew-rosters')
    .upload(storagePath, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    throw new Error('PDF encontrado, mas não foi possível salvar o arquivo dentro do app.');
  }

  const { error: metadataError } = await supabase.from('imported_rosters').upsert(
    [
      {
        user_id: userId,
        file_name: TARGET_FILENAME,
        source_message_id: sourceMessageId,
        storage_path: storagePath,
      },
    ],
    { onConflict: 'user_id,source_message_id' }
  );

  if (metadataError) {
    throw new Error('PDF salvo no app, mas não foi possível registrar os metadados do arquivo.');
  }
}

async function fetchCrewRosterPdf(userId: string, providerToken: string): Promise<PdfFetchResult> {
  const candidateMessageIds = await listCandidateMessageIds(providerToken);
  let foundPdf = false;
  let bestText = '';
  let bestCount = 0;

  for (const messageId of candidateMessageIds) {
    const message = await gmailFetch<GmailMessageResponse>(
      providerToken,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`
    );

    const attachment = findCrewRosterAttachment(message.payload);
    if (!attachment) continue;

    foundPdf = true;

    const attachmentData = await gmailFetch<{ data?: string }>(
      providerToken,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachment.attachmentId}`
    );

    if (!attachmentData.data) continue;

    const pdfBytes = decodeBase64UrlToBytes(attachmentData.data);
    await savePdfIntoApp(userId, messageId, pdfBytes);

    let extractedText = '';
    try {
      extractedText = await extractTextFromPdf(pdfBytes);
    } catch {
      continue;
    }

    const parsed = parseMockSchedule(extractedText);
    if (parsed.length > bestCount) {
      bestCount = parsed.length;
      bestText = extractedText;
    }

    if (bestCount > 0) break;
  }

  return { text: bestText, parsedCount: bestCount, foundPdf };
}

export async function importScheduleFromGmail(
  userId: string,
  providerToken: string
): Promise<ImportScheduleResult> {
  const { text, parsedCount, foundPdf } = await fetchCrewRosterPdf(userId, providerToken);

  if (!foundPdf) {
    return {
      importedCount: 0,
      parsedCount: 0,
      airline: 'Não identificada',
      reason: `Não encontrei o arquivo ${TARGET_FILENAME} no Gmail.`,
    };
  }

  if (!text || parsedCount === 0) {
    return {
      importedCount: 0,
      parsedCount: 0,
      airline: 'Não identificada',
      reason: `Encontrei e salvei o ${TARGET_FILENAME} no app, mas não consegui extrair voos dele.`,
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
