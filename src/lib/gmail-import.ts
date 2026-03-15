import { supabase } from '@/integrations/supabase/client';
import { detectAirline, parseMockSchedule } from '@/lib/store';
import type { ScheduleEntry } from '@/lib/types';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

type GmailListResponse = {
  messages?: Array<{ id: string }>;
  nextPageToken?: string;
};

type GmailHeader = {
  name?: string;
  value?: string;
};

type GmailMessageResponse = {
  id: string;
  payload?: GmailPayload;
};

type GmailPayload = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
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

type ImportRouteOptions = {
  subject?: string;
  filenameBase?: string;
};

type PdfCandidate = {
  messageId: string;
  pdfBytes: Uint8Array;
};

type PdfFetchResult = {
  text: string;
  parsedCount: number;
  foundSubject: boolean;
  foundFile: boolean;
};

const GMAIL_SCOPE_ERROR = 'GMAIL_SCOPE_MISSING';
const DEFAULT_SUBJECT = 'IFlight';
const DEFAULT_FILENAME_BASE = 'CrewRosterReport';
const STORAGE_FILENAME = 'CrewRosterReport.pdf';

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeFileName(value: string): string {
  return value.toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]/g, '');
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

function getHeaderValue(headers: GmailHeader[] | undefined, headerName: string): string {
  if (!headers?.length) return '';
  const lowerName = headerName.toLowerCase();
  const match = headers.find((header) => normalizeText(header.name ?? '') === lowerName);
  return match?.value ?? '';
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

async function listCandidateMessageIds(providerToken: string, subject: string, filenameBase: string): Promise<string[]> {
  const queries = [
    `subject:"${subject}" has:attachment filename:${filenameBase}`,
    `subject:"${subject}" has:attachment`,
    `has:attachment filename:${filenameBase}`,
  ];

  const messageIds = new Set<string>();

  for (const query of queries) {
    let nextPageToken: string | undefined;
    let pages = 0;

    do {
      const queryParams = new URLSearchParams({
        maxResults: '50',
        q: query,
      });

      if (nextPageToken) {
        queryParams.set('pageToken', nextPageToken);
      }

      const list = await gmailFetch<GmailListResponse>(
        providerToken,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${queryParams.toString()}`
      );

      (list.messages ?? []).forEach((message) => messageIds.add(message.id));
      nextPageToken = list.nextPageToken;
      pages += 1;
    } while (nextPageToken && pages < 3 && messageIds.size < 120);

    if (messageIds.size > 0) break;
  }

  return Array.from(messageIds);
}

function findPdfPart(payload: GmailPayload | undefined, filenameBase: string): GmailPayload | null {
  if (!payload) return null;

  const mimeType = normalizeText(payload.mimeType ?? '');
  const filename = payload.filename ?? '';
  const normalizedFilename = normalizeFileName(filename);
  const normalizedBase = normalizeFileName(filenameBase);

  const isPdf = mimeType.includes('pdf') || filename.toLowerCase().endsWith('.pdf');
  const hasData = Boolean(payload.body?.attachmentId || payload.body?.data);
  const matchesFile = normalizedFilename.includes(normalizedBase);

  if (isPdf && hasData && matchesFile) {
    return payload;
  }

  if (!payload.parts?.length) return null;

  for (const part of payload.parts) {
    const nested = findPdfPart(part, filenameBase);
    if (nested) return nested;
  }

  return null;
}

async function loadPdfBytesFromPart(
  providerToken: string,
  messageId: string,
  part: GmailPayload
): Promise<Uint8Array | null> {
  if (part.body?.data) {
    return decodeBase64UrlToBytes(part.body.data);
  }

  if (!part.body?.attachmentId) {
    return null;
  }

  const attachment = await gmailFetch<{ data?: string }>(
    providerToken,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${part.body.attachmentId}`
  );

  if (!attachment.data) return null;
  return decodeBase64UrlToBytes(attachment.data);
}

async function findPdfInGmail(
  providerToken: string,
  subject: string,
  filenameBase: string
): Promise<{ candidate: PdfCandidate | null; foundSubject: boolean; foundFile: boolean }> {
  const messageIds = await listCandidateMessageIds(providerToken, subject, filenameBase);

  let foundSubject = false;
  let foundFile = false;

  for (const messageId of messageIds) {
    const message = await gmailFetch<GmailMessageResponse>(
      providerToken,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`
    );

    const subjectHeader = getHeaderValue(message.payload?.headers, 'Subject');
    const subjectMatches = normalizeText(subjectHeader).includes(normalizeText(subject));
    if (!subjectMatches) continue;

    foundSubject = true;

    const pdfPart = findPdfPart(message.payload, filenameBase);
    if (!pdfPart) continue;

    foundFile = true;

    const pdfBytes = await loadPdfBytesFromPart(providerToken, message.id, pdfPart);
    if (!pdfBytes) continue;

    return {
      candidate: {
        messageId: message.id,
        pdfBytes,
      },
      foundSubject,
      foundFile,
    };
  }

  return { candidate: null, foundSubject, foundFile };
}

async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
  const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const textChunks: string[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();

    const pageText = content.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (pageText) {
      textChunks.push(pageText);
    }
  }

  return textChunks.join('\n');
}

function toFourDigitYear(year: string): string {
  if (year.length === 4) return year;
  const numericYear = Number(year);
  return String(numericYear >= 70 ? 1900 + numericYear : 2000 + numericYear);
}

function normalizeDate(rawDate: string): string {
  const parts = rawDate.split(/[\/\-]/).map((part) => part.trim());
  if (parts.length !== 3) return rawDate;

  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  const year = toFourDigitYear(parts[2]);
  return `${day}/${month}/${year}`;
}

function calculateReportTimeFromDeparture(departureTime: string): string {
  const [h, m] = departureTime.split(':').map(Number);
  const reportMinutes = h * 60 + m - 60;
  const normalized = (reportMinutes + 1440) % 1440;
  const rh = Math.floor(normalized / 60);
  const rm = normalized % 60;
  return `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`;
}

function calculateDutyHours(dep: string, arr: string): number {
  const [dh, dm] = dep.split(':').map(Number);
  const [ah, am] = arr.split(':').map(Number);
  let diff = (ah * 60 + am) - (dh * 60 + dm);
  if (diff < 0) diff += 1440;
  return Math.round((diff / 60) * 10) / 10;
}

function parseScheduleFromPdfText(text: string): ScheduleEntry[] {
  const parsedByDefault = parseMockSchedule(text);
  if (parsedByDefault.length > 0) return parsedByDefault;

  const sanitized = text.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ');
  const airline = detectAirline(sanitized);
  const uniqueKeys = new Set<string>();
  const entries: ScheduleEntry[] = [];

  const patterns = [
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}).{0,30}?([A-Z]{2}\s?\d{3,4}).{0,24}?([A-Z]{3})\s*(?:[-–>]|\s)\s*([A-Z]{3}).{0,20}?(\d{1,2}:\d{2}).{0,10}?(\d{1,2}:\d{2})/g,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}).{0,30}?([A-Z]{2}\s?\d{3,4}).{0,20}?(\d{1,2}:\d{2}).{0,10}?(\d{1,2}:\d{2})/g,
  ];

  for (const pattern of patterns) {
    for (const match of sanitized.matchAll(pattern)) {
      const date = normalizeDate(match[1]);
      const flightNumber = match[2].replace(/\s/g, '').toUpperCase();

      const departure = match.length >= 6 ? (match[3] ?? 'TBD') : 'TBD';
      const arrival = match.length >= 6 ? (match[4] ?? 'TBD') : 'TBD';
      const departureTime = match.length >= 6 ? (match[5] ?? '00:00') : (match[3] ?? '00:00');
      const arrivalTime = match.length >= 6 ? (match[6] ?? '00:00') : (match[4] ?? '00:00');

      const key = `${date}|${flightNumber}|${departureTime}|${arrivalTime}`;
      if (uniqueKeys.has(key)) continue;
      uniqueKeys.add(key);

      entries.push({
        id: crypto.randomUUID(),
        date,
        flightNumber,
        departure,
        arrival,
        departureTime,
        arrivalTime,
        status: 'scheduled',
        airline,
        reportTime: calculateReportTimeFromDeparture(departureTime),
        dutyHours: calculateDutyHours(departureTime, arrivalTime),
      });
    }
  }

  return entries;
}

async function savePdfIntoApp(userId: string, messageId: string, pdfBytes: Uint8Array): Promise<void> {
  const storagePath = `${userId}/${STORAGE_FILENAME}`;
  const bytes = Uint8Array.from(pdfBytes);
  const pdfBlob = new Blob([bytes.buffer], { type: 'application/pdf' });

  const { error: uploadError } = await supabase.storage
    .from('crew-rosters')
    .upload(storagePath, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    throw new Error('Encontrei o PDF no Gmail, mas não consegui salvar o arquivo no app.');
  }

  const { error: metadataError } = await supabase.from('imported_rosters').upsert(
    [
      {
        user_id: userId,
        file_name: STORAGE_FILENAME,
        source_message_id: messageId,
        storage_path: storagePath,
      },
    ],
    { onConflict: 'user_id,source_message_id' }
  );

  if (metadataError) {
    throw new Error('PDF salvo no storage, mas não consegui registrar esse arquivo no app.');
  }
}

async function fetchCrewRosterPdf(
  userId: string,
  providerToken: string,
  subject: string,
  filenameBase: string
): Promise<PdfFetchResult> {
  const { candidate, foundSubject, foundFile } = await findPdfInGmail(providerToken, subject, filenameBase);

  if (!candidate) {
    return {
      text: '',
      parsedCount: 0,
      foundSubject,
      foundFile,
    };
  }

  await savePdfIntoApp(userId, candidate.messageId, candidate.pdfBytes);

  let text = '';
  try {
    text = await extractTextFromPdf(candidate.pdfBytes);
  } catch {
    return {
      text: '',
      parsedCount: 0,
      foundSubject,
      foundFile,
    };
  }

  const parsedCount = parseMockSchedule(text).length;

  return {
    text,
    parsedCount,
    foundSubject,
    foundFile,
  };
}

export async function importScheduleFromGmail(
  userId: string,
  providerToken: string,
  options?: ImportRouteOptions
): Promise<ImportScheduleResult> {
  const subject = options?.subject ?? DEFAULT_SUBJECT;
  const filenameBase = options?.filenameBase ?? DEFAULT_FILENAME_BASE;

  const { text, parsedCount, foundSubject, foundFile } = await fetchCrewRosterPdf(
    userId,
    providerToken,
    subject,
    filenameBase
  );

  if (!foundSubject) {
    return {
      importedCount: 0,
      parsedCount: 0,
      airline: 'Não identificada',
      reason: `Não encontrei e-mails com título "${subject}".`,
    };
  }

  if (!foundFile) {
    return {
      importedCount: 0,
      parsedCount: 0,
      airline: 'Não identificada',
      reason: `Encontrei o e-mail "${subject}", mas sem PDF "${filenameBase}".`,
    };
  }

  if (!text || parsedCount === 0) {
    return {
      importedCount: 0,
      parsedCount: 0,
      airline: 'Não identificada',
      reason: `O PDF "${filenameBase}" foi salvo no app, mas não consegui extrair voos dele.`,
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
