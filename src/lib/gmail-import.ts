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

type GmailAttachmentLog = {
  messageId: string;
  filename: string;
  attachmentId: string;
};

type ImportDebugLog = {
  emailCount: number;
  subjects: string[];
  pdfAttachments: GmailAttachmentLog[];
  selectedAttachmentId: string | null;
  downloadSucceeded: boolean;
};

type ImportScheduleResult = {
  importedCount: number;
  parsedCount: number;
  airline: string;
  reason?: string;
  parserError?: string;
  debug: ImportDebugLog;
};

type ImportRouteOptions = {
  searchQuery?: string;
  subjectContains?: string;
  senderContains?: string;
};

type PdfCandidate = {
  messageId: string;
  attachmentId: string;
  pdfBytes: Uint8Array;
};

type PdfFetchResult = {
  text: string;
  foundSubject: boolean;
  foundSender: boolean;
  foundPdf: boolean;
  parserError?: string;
  debug: ImportDebugLog;
};

const GMAIL_SCOPE_ERROR = 'GMAIL_SCOPE_MISSING';
const DEFAULT_SEARCH_QUERY = 'has:attachment filename:pdf newer_than:180d';
const DEFAULT_SUBJECT_CONTAINS = 'CrewRosterReport';
const DEFAULT_SENDER_CONTAINS = 'iFlight';
const STORAGE_FILENAME = 'CrewRosterReport.pdf';

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
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

async function listCandidateMessageIds(providerToken: string, query: string): Promise<string[]> {
  const messageIds = new Set<string>();
  let nextPageToken: string | undefined;
  let pages = 0;

  do {
    const queryParams = new URLSearchParams({
      maxResults: '100',
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
  } while (nextPageToken && pages < 5 && messageIds.size < 300);

  return Array.from(messageIds);
}

function extractFilenameFromHeaderValue(headerValue: string): string {
  const match = headerValue.match(/filename\*?=(?:UTF-8''|"|')?([^"';\n]+)/i);
  if (!match?.[1]) return '';

  const rawFilename = match[1].trim();
  try {
    return decodeURIComponent(rawFilename);
  } catch {
    return rawFilename;
  }
}

function getPartFilename(part: GmailPayload): string {
  if (part.filename?.trim()) {
    return part.filename.trim();
  }

  const contentDisposition = getHeaderValue(part.headers, 'Content-Disposition');
  const fromDisposition = extractFilenameFromHeaderValue(contentDisposition);
  if (fromDisposition) return fromDisposition;

  const contentType = getHeaderValue(part.headers, 'Content-Type');
  return extractFilenameFromHeaderValue(contentType);
}

type PdfPartCandidate = {
  part: GmailPayload;
  filename: string;
  attachmentId: string;
};

function collectPdfParts(payload: GmailPayload | undefined, results: PdfPartCandidate[] = []): PdfPartCandidate[] {
  if (!payload) return results;

  const mimeType = normalizeText(payload.mimeType ?? '');
  const filename = getPartFilename(payload);
  const hasData = Boolean(payload.body?.attachmentId || payload.body?.data);
  const isPdf = mimeType.includes('pdf') || filename.toLowerCase().endsWith('.pdf');

  if (hasData && isPdf) {
    results.push({
      part: payload,
      filename: filename || '(sem nome)',
      attachmentId: payload.body?.attachmentId ?? 'inline-data',
    });
  }

  for (const part of payload.parts ?? []) {
    collectPdfParts(part, results);
  }

  return results;
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
  searchQuery: string,
  subjectContains: string,
  senderContains: string
): Promise<{ candidate: PdfCandidate | null; foundSubject: boolean; foundSender: boolean; foundPdf: boolean; debug: ImportDebugLog }> {
  const messageIds = await listCandidateMessageIds(providerToken, searchQuery);
  const normalizedSubject = normalizeText(subjectContains);
  const normalizedSender = normalizeText(senderContains);

  const subjects = new Set<string>();
  const debug: ImportDebugLog = {
    emailCount: messageIds.length,
    subjects: [],
    pdfAttachments: [],
    selectedAttachmentId: null,
    downloadSucceeded: false,
  };

  let foundSubject = false;
  let foundSender = false;
  let foundPdf = false;

  for (const messageId of messageIds) {
    const message = await gmailFetch<GmailMessageResponse>(
      providerToken,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`
    );

    const subjectHeader = getHeaderValue(message.payload?.headers, 'Subject');
    if (subjectHeader) {
      subjects.add(subjectHeader);
      debug.subjects = Array.from(subjects).slice(0, 30);
    }

    if (!normalizeText(subjectHeader).includes(normalizedSubject)) {
      continue;
    }

    foundSubject = true;

    const fromHeader = getHeaderValue(message.payload?.headers, 'From');
    if (!normalizeText(fromHeader).includes(normalizedSender)) {
      continue;
    }

    foundSender = true;

    const pdfParts = collectPdfParts(message.payload);
    if (pdfParts.length === 0) {
      continue;
    }

    foundPdf = true;

    for (const pdfPart of pdfParts) {
      debug.pdfAttachments.push({
        messageId: message.id,
        filename: pdfPart.filename,
        attachmentId: pdfPart.attachmentId,
      });
    }

    const selectedPart = pdfParts[0];
    debug.selectedAttachmentId = selectedPart.attachmentId;

    const pdfBytes = await loadPdfBytesFromPart(providerToken, message.id, selectedPart.part);
    if (!pdfBytes) {
      continue;
    }

    debug.downloadSucceeded = true;

    return {
      candidate: {
        messageId: message.id,
        attachmentId: selectedPart.attachmentId,
        pdfBytes,
      },
      foundSubject,
      foundSender,
      foundPdf,
      debug,
    };
  }

  return { candidate: null, foundSubject, foundSender, foundPdf, debug };
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

  const parsedCount = parseScheduleFromPdfText(text).length;

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

  const parsedEntries = parseScheduleFromPdfText(text);
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
