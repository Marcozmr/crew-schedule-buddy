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
  rosterId?: string | null;
  reason?: string;
  parserError?: string;
  diagnostic: ImportDiagnostic;
};
...
function buildImportResult(
  importedCount: number,
  parsedCount: number,
  airline: string,
  diagnostic: ImportDiagnostic,
  reason?: string,
  parserError?: string,
  rosterId: string | null = null
): ImportScheduleResult {
  return {
    importedCount,
    parsedCount,
    airline,
    rosterId,
    reason,
    parserError,
    diagnostic: finalizeDiagnostic(diagnostic),
  };
}

async function savePdfIntoApp(userId: string, _messageId: string, pdfBytes: Uint8Array): Promise<SavePdfResult> {
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
      storagePath: null,
    };
  }

  return {
    ok: true,
    warning: null,
    storagePath,
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

  const { data: authData } = await supabase.auth.getUser();
  const authenticatedUserId = authData.user?.id ?? null;
  const effectiveUserId = authenticatedUserId ?? userId;

  if (authenticatedUserId && authenticatedUserId !== userId) {
    console.warn('[gmail-import] userId divergente detectado, usando auth.uid atual', {
      passedUserId: userId,
      authUserId: authenticatedUserId,
    });
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

  const savePdfResult = await savePdfIntoApp(effectiveUserId, searchResult.candidate.messageId, searchResult.candidate.pdfBytes);
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
    diagnostic.parser_failure_log_path = await saveParserFailureLog(effectiveUserId, searchResult.candidate.messageId, extractedText, parserError);

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
    diagnostic.parser_failure_log_path = await saveParserFailureLog(effectiveUserId, searchResult.candidate.messageId, extractedText, parserError);

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

  // Desativa escala ativa anterior e cria nova escala ativa para este import Gmail
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('imported_rosters') as any)
    .update({ is_active: false })
    .eq('user_id', effectiveUserId)
    .eq('is_active', true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rosterRow, error: rosterError } = await (supabase.from('imported_rosters') as any)
    .insert({
      user_id: effectiveUserId,
      file_name: searchResult.candidate.attachmentName || STORAGE_FILENAME,
      source_message_id: searchResult.candidate.messageId,
      storage_path: savePdfResult.storagePath,
      parser_version: 'gmail-import-v2',
      import_status: 'processing',
      parsed_count: parsedEntries.length,
      inserted_count: 0,
      is_active: true,
      raw_text_excerpt: extractedText.substring(0, 2000),
    })
    .select('id')
    .single();

  if (rosterError || !rosterRow?.id) {
    diagnostic.db_insert_ok = false;
    diagnostic.final_error = `Não foi possível criar a importação ativa: ${rosterError?.message || 'erro desconhecido'}`;
    return buildImportResult(0, parsedEntries.length, airline, diagnostic, diagnostic.final_error);
  }

  const rosterId = rosterRow.id as string;

  const parsedRows = parsedEntries.map((entry) => {
    const [day, month, year] = entry.date.split('/');
    const isoDate = day && month && year ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` : entry.date;
    return {
      user_id: effectiveUserId,
      roster_id: rosterId,
      date: isoDate,
      flight_number: entry.flightNumber,
      departure: entry.departure,
      arrival: entry.arrival,
      departure_time: entry.departureTime,
      arrival_time: entry.arrivalTime,
      status: entry.status,
      airline: entry.airline,
      report_time: entry.reportTime || null,
      duty_hours: entry.dutyHours || null,
      flight_hours: entry.dutyHours || null,
      is_flight: true,
      activity_type: 'flight',
      sort_datetime: `${isoDate}T${(entry.departureTime || '00:00')}:00`,
    };
  });

  let insertedRowsCount = 0;

  if (parsedRows.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: bulkInsertError } = await (supabase.from('schedule_entries') as any).insert(parsedRows);

    if (bulkInsertError) {
      let partialInsertCount = 0;
      let lastSingleErrorMessage: string | null = null;

      for (const row of parsedRows) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: singleInsertError } = await (supabase.from('schedule_entries') as any).insert([row]);
        if (!singleInsertError) {
          partialInsertCount += 1;
        } else {
          lastSingleErrorMessage = singleInsertError.message;
        }
      }

      if (partialInsertCount === 0) {
        diagnostic.db_insert_ok = false;
        diagnostic.final_error = `Não foi possível salvar os voos na tabela schedule_entries. ${bulkInsertError.message}`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('imported_rosters') as any)
          .update({ import_status: 'error', import_error: diagnostic.final_error, inserted_count: 0 })
          .eq('id', rosterId);
        return buildImportResult(0, parsedEntries.length, airline, diagnostic, diagnostic.final_error);
      }

      insertedRowsCount = partialInsertCount;
      diagnostic.final_error = lastSingleErrorMessage
        ? `Inserção parcial concluída. Último erro: ${lastSingleErrorMessage}`
        : savePdfResult.warning;
    } else {
      insertedRowsCount = parsedRows.length;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('imported_rosters') as any)
    .update({
      import_status: insertedRowsCount > 0 ? 'success' : 'error',
      import_error: insertedRowsCount > 0 ? null : 'Nenhuma linha inserida',
      inserted_count: insertedRowsCount,
    })
    .eq('id', rosterId);

  const { count: rosterRowsCountAfterInsert } = await supabase
    .from('schedule_entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', effectiveUserId)
    .eq('roster_id', rosterId);

  if (insertedRowsCount > 0 && (rosterRowsCountAfterInsert ?? 0) === 0) {
    diagnostic.db_insert_ok = false;
    diagnostic.final_error = 'Os voos não ficaram vinculados ao roster ativo.';
    return buildImportResult(0, parsedEntries.length, airline, diagnostic, diagnostic.final_error);
  }

  diagnostic.db_insert_ok = true;
  diagnostic.inserted_rows_count = insertedRowsCount;
  if (!diagnostic.final_error) {
    diagnostic.final_error = savePdfResult.warning;
  }

  if (airline !== 'Não identificada') {
    await supabase.from('profiles').update({ airline }).eq('user_id', effectiveUserId);
  }

  const reason = insertedRowsCount === 0 ? 'Importação processada, mas sem voos novos para inserir.' : savePdfResult.warning ?? undefined;
  return buildImportResult(insertedRowsCount, parsedEntries.length, airline, diagnostic, reason);
}

export function isGmailScopeError(error: unknown): boolean {
  return error instanceof Error && error.message === GMAIL_SCOPE_ERROR;
}
