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

export type GmailAttachmentFound = {
  messageId: string;
  name: string;
  mimeType: string;
  attachmentId: string;
};

export type ImportDiagnostic = {
  authenticated: boolean;
  gmail_scope_ok: boolean;
  emails_found: number;
  matched_email_subjects: string[];
  attachments_found: GmailAttachmentFound[];
  selected_attachment_name: string | null;
  attachment_download_ok: boolean;
  pdf_saved_ok: boolean;
  parser_ok: boolean;
  parsed_flights_count: number;
  parsed_entries_preview: Array<Pick<ScheduleEntry, 'date' | 'flightNumber' | 'departure' | 'arrival' | 'departureTime' | 'arrivalTime'>>;
  db_insert_ok: boolean;
  inserted_rows_count: number;
  final_error: string | null;
  email_encontrado: boolean;
  pdf_baixado: boolean;
  pdf_parseado: boolean;
  voos_salvos: boolean;
  dashboard_atualizado: boolean;
  parser_failure_log_path: string | null;
};

export type ImportScheduleResult = {
  importedCount: number;
  parsedCount: number;
  airline: string;
  reason?: string;
  parserError?: string;
  diagnostic: ImportDiagnostic;
};

type ImportRouteOptions = {
  searchQuery?: string;
  subjectContains?: string;
  senderContains?: string;
};

type PdfCandidate = {
  messageId: string;
  attachmentId: string;
  attachmentName: string;
  pdfBytes: Uint8Array;
};

type GmailSearchResult = {
  candidate: PdfCandidate | null;
  emailsFound: number;
  matchedEmailSubjects: string[];
  attachmentsFound: GmailAttachmentFound[];
  attachmentDownloadOk: boolean;
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
  mimeType: string;
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
      mimeType: payload.mimeType || 'application/pdf',
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
): Promise<GmailSearchResult> {
  const messageIds = await listCandidateMessageIds(providerToken, searchQuery);
  const normalizedSubject = normalizeText(subjectContains);
  const normalizedSender = normalizeText(senderContains);

  const matchedSubjects = new Set<string>();
  const attachmentsFound: GmailAttachmentFound[] = [];

  for (const messageId of messageIds) {
    const message = await gmailFetch<GmailMessageResponse>(
      providerToken,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`
    );

    const subjectHeader = getHeaderValue(message.payload?.headers, 'Subject');
    if (!normalizeText(subjectHeader).includes(normalizedSubject)) {
      continue;
    }

    const fromHeader = getHeaderValue(message.payload?.headers, 'From');
    if (!normalizeText(fromHeader).includes(normalizedSender)) {
      continue;
    }

    matchedSubjects.add(subjectHeader || '(sem assunto)');

    const pdfParts = collectPdfParts(message.payload);
    if (pdfParts.length === 0) {
      continue;
    }

    for (const pdfPart of pdfParts) {
      attachmentsFound.push({
        messageId: message.id,
        name: pdfPart.filename,
        mimeType: pdfPart.mimeType,
        attachmentId: pdfPart.attachmentId,
      });
    }

    const selectedPart = pdfParts[0];
    const pdfBytes = await loadPdfBytesFromPart(providerToken, message.id, selectedPart.part);
    if (!pdfBytes) {
      continue;
    }

    return {
      candidate: {
        messageId: message.id,
        attachmentId: selectedPart.attachmentId,
        attachmentName: selectedPart.filename,
        pdfBytes,
      },
      emailsFound: messageIds.length,
      matchedEmailSubjects: Array.from(matchedSubjects),
      attachmentsFound,
      attachmentDownloadOk: true,
    };
  }

  return {
    candidate: null,
    emailsFound: messageIds.length,
    matchedEmailSubjects: Array.from(matchedSubjects),
    attachmentsFound,
    attachmentDownloadOk: false,
  };
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

type SavePdfResult = {
  ok: boolean;
  warning: string | null;
};

function createInitialDiagnostic(authenticated: boolean): ImportDiagnostic {
  return {
    authenticated,
    gmail_scope_ok: false,
    emails_found: 0,
    matched_email_subjects: [],
    attachments_found: [],
    selected_attachment_name: null,
    attachment_download_ok: false,
    pdf_saved_ok: false,
    parser_ok: false,
    parsed_flights_count: 0,
    parsed_entries_preview: [],
    db_insert_ok: false,
    inserted_rows_count: 0,
    final_error: null,
    email_encontrado: false,
    pdf_baixado: false,
    pdf_parseado: false,
    voos_salvos: false,
    dashboard_atualizado: false,
    parser_failure_log_path: null,
  };
}

function finalizeDiagnostic(diagnostic: ImportDiagnostic): ImportDiagnostic {
  return {
    ...diagnostic,
    email_encontrado: diagnostic.email_encontrado || diagnostic.matched_email_subjects.length > 0,
    pdf_baixado: diagnostic.attachment_download_ok,
    pdf_parseado: diagnostic.parser_ok && diagnostic.parsed_flights_count > 0,
    voos_salvos: diagnostic.inserted_rows_count > 0,
  };
}

function buildImportResult(
  importedCount: number,
  parsedCount: number,
  airline: string,
  diagnostic: ImportDiagnostic,
  reason?: string,
  parserError?: string
): ImportScheduleResult {
  return {
    importedCount,
    parsedCount,
    airline,
    reason,
    parserError,
    diagnostic: finalizeDiagnostic(diagnostic),
  };
}

async function savePdfIntoApp(userId: string, messageId: string, pdfBytes: Uint8Array): Promise<SavePdfResult> {
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
    return {
      ok: false,
      warning: 'Encontrei o PDF no Gmail, mas não consegui salvar o arquivo bruto no storage.',
    };
  }

  const { error: metadataError } = await supabase.from('imported_rosters').insert([
    {
      user_id: userId,
      file_name: STORAGE_FILENAME,
      source_message_id: messageId,
      storage_path: storagePath,
    },
  ]);

  return {
    ok: true,
    warning: metadataError ? 'PDF salvo no storage, mas não consegui registrar metadados na tabela imported_rosters.' : null,
  };
}

async function saveParserFailureLog(
  userId: string,
  messageId: string,
  extractedText: string,
  parserError: string
): Promise<string | null> {
  const parserLogPath = `${userId}/parser-failures/${messageId}-${Date.now()}.txt`;
  const payload = `parser_error: ${parserError}\n\nextracted_text:\n${extractedText}`;
  const blob = new Blob([payload], { type: 'text/plain;charset=utf-8' });

  const { error } = await supabase.storage
    .from('crew-rosters')
    .upload(parserLogPath, blob, { upsert: true, contentType: 'text/plain' });

  if (error) return null;
  return parserLogPath;
}

export async function importScheduleFromGmail(
  userId: string,
  providerToken: string,
  options?: ImportRouteOptions
): Promise<ImportScheduleResult> {
  const diagnostic = createInitialDiagnostic(Boolean(userId));
  const searchQuery = options?.searchQuery ?? DEFAULT_SEARCH_QUERY;
  const subjectContains = options?.subjectContains ?? DEFAULT_SUBJECT_CONTAINS;
  const senderContains = options?.senderContains ?? DEFAULT_SENDER_CONTAINS;

  if (!userId) {
    diagnostic.final_error = 'Usuário não autenticado.';
    return buildImportResult(0, 0, 'Não identificada', diagnostic, diagnostic.final_error);
  }

  if (!providerToken) {
    diagnostic.final_error = 'Token do Google ausente para leitura do Gmail.';
    return buildImportResult(0, 0, 'Não identificada', diagnostic, diagnostic.final_error);
  }

  let searchResult: GmailSearchResult;
  try {
    searchResult = await findPdfInGmail(providerToken, searchQuery, subjectContains, senderContains);
    diagnostic.gmail_scope_ok = true;
  } catch (error) {
    diagnostic.gmail_scope_ok = !isGmailScopeError(error);
    diagnostic.final_error = isGmailScopeError(error)
      ? 'Permissão Gmail ausente ou expirada (gmail.readonly).'
      : error instanceof Error
        ? error.message
        : 'Falha inesperada ao buscar e-mails no Gmail.';

    return buildImportResult(0, 0, 'Não identificada', diagnostic, diagnostic.final_error);
  }

  diagnostic.emails_found = searchResult.emailsFound;
  diagnostic.matched_email_subjects = searchResult.matchedEmailSubjects;
  diagnostic.attachments_found = searchResult.attachmentsFound;
  diagnostic.attachment_download_ok = searchResult.attachmentDownloadOk;
  diagnostic.selected_attachment_name = searchResult.candidate?.attachmentName ?? null;
  diagnostic.email_encontrado = searchResult.matchedEmailSubjects.length > 0;

  if (!searchResult.candidate) {
    diagnostic.final_error = 'Nenhum e-mail com assunto/remetente esperado e PDF baixável foi encontrado.';
    return buildImportResult(0, 0, 'Não identificada', diagnostic, diagnostic.final_error);
  }

  const savePdfResult = await savePdfIntoApp(userId, searchResult.candidate.messageId, searchResult.candidate.pdfBytes);
  diagnostic.pdf_saved_ok = savePdfResult.ok;

  if (!savePdfResult.ok) {
    diagnostic.final_error = savePdfResult.warning;
    return buildImportResult(0, 0, 'Não identificada', diagnostic, diagnostic.final_error ?? undefined);
  }

  let extractedText = '';
  try {
    extractedText = await extractTextFromPdf(searchResult.candidate.pdfBytes);
  } catch (error) {
    const parserError = error instanceof Error ? error.message : 'Falha ao extrair texto do PDF.';
    diagnostic.parser_ok = false;
    diagnostic.final_error = parserError;
    diagnostic.parser_failure_log_path = await saveParserFailureLog(userId, searchResult.candidate.messageId, extractedText, parserError);

    return buildImportResult(0, 0, 'Não identificada', diagnostic, `Falha no parser: ${parserError}`, parserError);
  }

  let parsedEntries: ScheduleEntry[] = [];
  try {
    parsedEntries = parseScheduleFromPdfText(extractedText);
    diagnostic.parser_ok = true;
  } catch (error) {
    const parserError = error instanceof Error ? error.message : 'Erro desconhecido no parser de escala.';
    diagnostic.parser_ok = false;
    diagnostic.final_error = parserError;
    diagnostic.parser_failure_log_path = await saveParserFailureLog(userId, searchResult.candidate.messageId, extractedText, parserError);

    return buildImportResult(0, 0, 'Não identificada', diagnostic, `Falha no parser: ${parserError}`, parserError);
  }

  diagnostic.parsed_flights_count = parsedEntries.length;
  diagnostic.parsed_entries_preview = parsedEntries.slice(0, 5).map((entry) => ({
    date: entry.date,
    flightNumber: entry.flightNumber,
    departure: entry.departure,
    arrival: entry.arrival,
    departureTime: entry.departureTime,
    arrivalTime: entry.arrivalTime,
  }));

  if (parsedEntries.length === 0) {
    diagnostic.final_error = 'Parser executado, mas nenhum voo foi identificado no conteúdo do PDF.';
    return buildImportResult(0, 0, 'Não identificada', diagnostic, diagnostic.final_error);
  }

  const airline = detectAirline(extractedText);

  const { data: existingRows, error: existingRowsError } = await supabase
    .from('schedule_entries')
    .select('date, flight_number, departure_time, arrival_time')
    .eq('user_id', userId);

  if (existingRowsError) {
    diagnostic.final_error = 'Não foi possível ler os voos atuais no banco para deduplicação.';
    return buildImportResult(0, parsedEntries.length, airline, diagnostic, diagnostic.final_error);
  }

  const existingKeys = new Set(
    (existingRows ?? []).map((row) => `${row.date}|${row.flight_number}|${row.departure_time}|${row.arrival_time}`)
  );

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
    .filter((row) => !existingKeys.has(`${row.date}|${row.flight_number}|${row.departure_time}|${row.arrival_time}`));

  if (rows.length > 0) {
    const { error } = await supabase.from('schedule_entries').insert(rows);
    if (error) {
      diagnostic.db_insert_ok = false;
      diagnostic.final_error = 'Não foi possível salvar os voos na tabela schedule_entries.';
      return buildImportResult(0, parsedEntries.length, airline, diagnostic, diagnostic.final_error);
    }
  }

  diagnostic.db_insert_ok = true;
  diagnostic.inserted_rows_count = rows.length;
  diagnostic.final_error = savePdfResult.warning;

  if (airline !== 'Não identificada') {
    await supabase.from('profiles').update({ airline }).eq('user_id', userId);
  }

  const reason = rows.length === 0 ? 'Importação processada, mas sem voos novos para inserir.' : savePdfResult.warning ?? undefined;
  return buildImportResult(rows.length, parsedEntries.length, airline, diagnostic, reason);
}

export function isGmailScopeError(error: unknown): boolean {
  return error instanceof Error && error.message === GMAIL_SCOPE_ERROR;
}
