import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeCrewRosterPdfText,
  parseCrewRosterEntries,
  parseRosterDateToken,
  PARSER_VERSION,
  type CrewRosterParsedEntry,
  type CrewRosterParseStats,
} from '@/lib/roster/crew-roster-parser';
import { isOfficialCrewRosterFileName } from '@/lib/roster/official-crew-roster';
import type { UserRosterConnectionType } from '@/modules/roster/services/UserRosterConnectionService';
import { dedupeScheduleEntryRows } from '@/lib/schedule-entry-dedupe';
import * as pdfjsLib from 'pdfjs-dist';

const isNodeRuntime =
  typeof window === 'undefined' &&
  typeof process !== 'undefined' &&
  Boolean((process as { versions?: { node?: string } }).versions?.node);

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Types ──────────────────────────────────────────────

export interface RosterHeader {
  crewName: string;
  employeeCode: string;
  crewGroupCode: string;
  baseAirport: string;
  crewRole: string;
  rosterStartDate: string;
  rosterEndDate: string;
  flyingHoursTotal: number | null;
  dutyHoursTotal: number | null;
}

export interface RosterEntry {
  date: string;
  activityType: string;
  isFlight: boolean;
  flightNumber: string;
  pairingCode: string;
  crewRole: string;
  operationType: string;
  reportTime: string;
  departureAirport: string;
  departureTime: string;
  arrivalAirport: string;
  arrivalTime: string;
  debriefTime: string;
  flightHours: number | null;
  dutyHours: number | null;
  aircraftType: string;
  hotelName: string;
  assignment: string;
  comments: string;
  rawLine: string;
  crossesMidnight: boolean;
  overnight: boolean;
  sortDatetime: string;
  entryType: string;
  crewStatusCode: string;
  crewStatusLabel: string;
  activityLabel: string;
}

export interface ImportDebugInfo {
  currentUserId: string;
  rosterId: string | null;
  deactivatedRosterIds: string[];
  activeRoster: { id: string; file_name: string | null; is_active: boolean; created_at: string } | null;
  totalRowsActiveRoster: number;
  totalRowsOldRosters: number;
}

export interface PdfImportResult {
  success: boolean;
  /** Mesmo binário já importado — nenhuma linha nova inserida. */
  duplicate?: boolean;
  header: RosterHeader | null;
  parsedCount: number;
  insertedCount: number;
  rosterId: string | null;
  fileName: string;
  extractedTextPreview: string;
  parsedEntriesPreview: RosterEntry[];
  savedRowsPreview: Record<string, unknown>[];
  debug: ImportDebugInfo;
  textByDay: Record<string, string>;
  parseStats: ParseStats;
  error: string | null;
}

export type ParseStats = CrewRosterParseStats;

export const EMPTY_PARSE_STATS: ParseStats = {
  totalEntries: 0,
  totalRawAnchors: 0,
  totalFlights: 0,
  totalDO: 0,
  totalStandby: 0,
  totalAPR: 0,
  totalReserve: 0,
  totalOnCall: 0,
  totalPresentation: 0,
  totalAfterDedup: 0,
  unrecognizedSnippetCount: 0,
};

// ── PDF Text Extraction ────────────────────────────────
/** pdf.js devolve itens em ordem arbitrária; ordenar por Y (linha) e X (coluna) evita “zero” em PDFs tabulares. */
type PdfTextItem = { str?: string; transform?: number[] };

function sortPdfTextItems(items: PdfTextItem[]): Array<{ str: string; x: number; y: number }> {
  const pieces: Array<{ str: string; x: number; y: number }> = [];
  for (const item of items) {
    const raw = item.str;
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const t = item.transform;
    if (!t || t.length < 6) continue;
    pieces.push({ str: raw.trim(), x: t[4], y: t[5] });
  }
  const lineTol = 6;
  pieces.sort((a, b) => {
    if (Math.abs(a.y - b.y) > lineTol) return b.y - a.y;
    return a.x - b.x;
  });
  return pieces;
}

async function extractTextFromPdf(pdfBytes: ArrayBuffer): Promise<string> {
  let lib: typeof pdfjsLib;
  if (isNodeRuntime) {
    const legacy = await import('pdfjs-dist/legacy/build/pdf.mjs');
    lib = legacy as unknown as typeof pdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = '';
  } else {
    lib = pdfjsLib;
    const mod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    lib.GlobalWorkerOptions.workerSrc = (mod as { default: string }).default;
  }
  const doc = await lib.getDocument({ data: pdfBytes, verbosity: 0 }).promise;
  const chunks: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const sorted = sortPdfTextItems(content.items as PdfTextItem[]);
    const pageText = sorted.map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim();
    if (pageText) chunks.push(pageText);
  }
  return chunks.join('\n');
}

function parseHoursMinutes(val: string): number {
  const parts = val.split(/[.:]/);
  const h = parseInt(parts[0]) || 0;
  const m = parseInt(parts[1]) || 0;
  return Math.round((h + m / 60) * 100) / 100;
}

// ── Header Parser ──────────────────────────────────────

function parseHeader(text: string): RosterHeader {
  const header: RosterHeader = {
    crewName: '', employeeCode: '', crewGroupCode: '', baseAirport: '', crewRole: '',
    rosterStartDate: '', rosterEndDate: '', flyingHoursTotal: null, dutyHoursTotal: null,
  };

  const nameMatch = text.match(/(?:Name|Crew|Tripulante)[:\s]+([A-Z][A-Za-zÀ-ÿ\s,.-]+)/i);
  if (nameMatch) header.crewName = nameMatch[1].trim();

  const empMatch = text.match(/(?:Emp(?:loyee)?|Matr[ií]cula|Code)[:\s#]*(\d{4,8})/i);
  if (empMatch) header.employeeCode = empMatch[1];

  const groupMatch = text.match(/\b(JJ[A-Z]{2}\d{3})\b/i);
  if (groupMatch) header.crewGroupCode = groupMatch[1].toUpperCase();

  const baseMatch = text.match(/(?:Base|Home\s?Base)[:\s]+([A-Z]{3})/i);
  if (baseMatch) header.baseAirport = baseMatch[1].toUpperCase();

  // Try to extract base from header pattern: NAME | CODE | GROUP | BASE | ROLE
  if (!header.baseAirport) {
    const pipeMatch = text.match(/\|\s*([A-Z]{3})\s*\|\s*(CC|CA|FO|SO|CM|FA)/i);
    if (pipeMatch) header.baseAirport = pipeMatch[1].toUpperCase();
  }

  const roleMatch = text.match(/(?:Rank|Fun[çc][ãa]o|Position|Crew\s?Role)[:\s]+([A-Z]{2,5})/i);
  if (roleMatch) header.crewRole = roleMatch[1].toUpperCase();
  if (!header.crewRole) {
    const pipeRole = text.match(/\|\s*(CC|CA|FO|SO|CM|FA)\s/i);
    if (pipeRole) header.crewRole = pipeRole[1].toUpperCase();
  }

  const periodMatch = text.match(/(\d{1,2}[\s-][A-Za-z]{3}[\s-]\d{2,4})\s*(?:[-–to]+)\s*(\d{1,2}[\s-][A-Za-z]{3}[\s-]\d{2,4})/i);
  if (periodMatch) {
    header.rosterStartDate = parseRosterDateToken(periodMatch[1].replace(/\s+/g, '-')) || periodMatch[1];
    header.rosterEndDate = parseRosterDateToken(periodMatch[2].replace(/\s+/g, '-')) || periodMatch[2];
  }

  const fhMatch = text.match(/(?:FLYING|Flight)\s*(?:HRS?|Hours?|Time)[:\s|]*(\d+:\d{2})/i);
  if (fhMatch) header.flyingHoursTotal = parseHoursMinutes(fhMatch[1]);

  const dhMatch = text.match(/(?:DUTY)\s*(?:HRS?|Hours?|Time)[:\s|]*(\d+:\d{2})/i);
  if (dhMatch) header.dutyHoursTotal = parseHoursMinutes(dhMatch[1]);

  // Extract crew name from pipe-delimited header like "MAYARA BESSA | 04449142 | JJCC320 | BSB | CC"
  if (!header.crewName) {
    const nameFromPipe = text.match(/([A-Z][A-Z\s]{3,30})\s*\|\s*\d{4,8}/);
    if (nameFromPipe) header.crewName = nameFromPipe[1].trim();
  }
  if (!header.employeeCode) {
    const empFromPipe = text.match(/\|\s*(\d{4,8})\s*\|/);
    if (empFromPipe) header.employeeCode = empFromPipe[1];
  }

  return header;
}

function mapParsedToRosterEntry(p: CrewRosterParsedEntry): RosterEntry {
  return {
    date: p.date,
    activityType: p.activityType,
    isFlight: p.isFlight,
    flightNumber: p.flightNumber,
    pairingCode: p.pairingCode,
    crewRole: p.crewRole,
    operationType: p.operationType,
    reportTime: p.reportTime,
    departureAirport: p.departureAirport,
    departureTime: p.departureTime,
    arrivalAirport: p.arrivalAirport,
    arrivalTime: p.arrivalTime,
    debriefTime: p.debriefTime,
    flightHours: p.flightHours,
    dutyHours: p.dutyHours,
    aircraftType: p.aircraftType,
    hotelName: p.hotelName,
    assignment: p.assignment,
    comments: p.comments,
    rawLine: p.rawLine,
    crossesMidnight: p.crossesMidnight,
    overnight: p.overnight,
    sortDatetime: p.sortDatetime,
    entryType: p.entryType,
    crewStatusCode: p.crewStatusCode,
    crewStatusLabel: p.crewStatusLabel,
    activityLabel: p.activityLabel,
  };
}

// ── Main import function ───────────────────────────────

function duplicateResult(
  fileName: string,
  dupId: string,
  emptyDebug: ImportDebugInfo,
  emptyStats: ParseStats
): PdfImportResult {
  return {
    success: true,
    duplicate: true,
    header: null,
    parsedCount: 0,
    insertedCount: 0,
    rosterId: dupId,
    fileName,
    extractedTextPreview: '',
    parsedEntriesPreview: [],
    savedRowsPreview: [],
    debug: { ...emptyDebug, rosterId: dupId },
    textByDay: {},
    parseStats: emptyStats,
    error: null,
  };
}

export type PdfImportRunOptions = {
  /** Cliente Supabase (browser ou service role no backend de automação). */
  supabaseClient: SupabaseClient;
  fileName: string;
  arrayBuffer: ArrayBuffer;
  /**
   * Texto já extraído (ex.: relatório HTML Crew Roster convertido a texto no worker).
   * Quando definido, ignora `extractTextFromPdf` e usa este texto no parser LATAM.
   */
  extractedTextOverride?: string;
  /** user_id alvo (obrigatório em modo serviço). */
  userId: string;
  /**
   * true: resolve utilizador via auth.getUser() quando existir sessão (app).
   * false: usa apenas userId (importação servidor / automação LATAM).
   */
  useSessionUser: boolean;
  /** Emitir evento de roster atualizado (apenas browser). */
  emitRosterEvent: boolean;
  /** Origem gravada em imported_rosters / metadados. */
  importOrigin: 'manual' | 'latam_automation' | 'gol_automation' | 'azul_automation';
  /** Quando a importação vem do worker Playwright (coluna `automation_run_id`). */
  automationRunId?: string | null;
};

function isAutomationWorkerImport(importOrigin: PdfImportRunOptions['importOrigin']): boolean {
  return importOrigin === 'latam_automation' || importOrigin === 'gol_automation' || importOrigin === 'azul_automation';
}

/**
 * Importa PDF com cliente Supabase injetado — usado pelo serviço Node `roster-automation` (service role).
 * Não armazena credenciais; o PDF já foi obtido no fluxo autorizado do utilizador.
 */
export async function importPdfArrayBufferWithClient(opts: PdfImportRunOptions): Promise<PdfImportResult> {
  return importPdfArrayBufferCore(opts);
}

/**
 * Importa PDF a partir de bytes (upload, armazenamento ou “Abrir com”).
 * Dedupe: hash SHA-256, depois nome+tamanho, depois mesma storage_path no bucket.
 */
export async function importPdfArrayBuffer(
  fileName: string,
  arrayBuffer: ArrayBuffer,
  userId: string
): Promise<PdfImportResult> {
  const { supabase } = await import('@/integrations/supabase/client');
  return importPdfArrayBufferCore({
    supabaseClient: supabase,
    fileName,
    arrayBuffer,
    userId,
    useSessionUser: true,
    emitRosterEvent: true,
    importOrigin: 'manual',
    automationRunId: null,
  });
}

async function importPdfArrayBufferCore(params: PdfImportRunOptions): Promise<PdfImportResult> {
  const {
    supabaseClient,
    fileName,
    arrayBuffer,
    extractedTextOverride,
    userId,
    useSessionUser,
    emitRosterEvent,
    importOrigin,
    automationRunId,
  } = params;
  const emptyDebug: ImportDebugInfo = { currentUserId: userId, rosterId: null, deactivatedRosterIds: [], activeRoster: null, totalRowsActiveRoster: 0, totalRowsOldRosters: 0 };
  const emptyStats = EMPTY_PARSE_STATS;
  const emptyResult = (error: string): PdfImportResult => ({
    success: false, header: null, parsedCount: 0, insertedCount: 0, rosterId: null, fileName,
    extractedTextPreview: '', parsedEntriesPreview: [], savedRowsPreview: [],
    debug: { ...emptyDebug }, textByDay: {}, parseStats: emptyStats, error,
  });

  try {
    let effectiveUserId = userId;
    if (useSessionUser) {
      const { data: { user: authUser } } = await supabaseClient.auth.getUser();
      effectiveUserId = authUser?.id || userId;
    }

    const fileSizeBytes = arrayBuffer.byteLength;
    const contentSha256 = await sha256Hex(arrayBuffer);

    // Duplicata só bloqueia reprocessamento se já foi importada com a versão ATUAL do parser —
    // senão, um fix no parser (ex.: siglas que antes eram descartadas) nunca conseguiria corrigir
    // escalas já salvas, porque reenviar o mesmo PDF seria sempre tratado como "nada mudou".
    const { data: dupByHash } = await supabaseClient
      .from('imported_rosters')
      .select('id, parser_version')
      .eq('user_id', effectiveUserId)
      .eq('content_sha256', contentSha256)
      .limit(1)
      .maybeSingle();
    const hashDup = dupByHash as { id: string; parser_version: string | null } | null;
    if (hashDup?.id && hashDup.parser_version === PARSER_VERSION) {
      return duplicateResult(fileName, hashDup.id, emptyDebug, emptyStats);
    }

    const { data: dupByMeta } = await supabaseClient
      .from('imported_rosters')
      .select('id, parser_version')
      .eq('user_id', effectiveUserId)
      .eq('file_name', fileName)
      .eq('file_size_bytes', fileSizeBytes)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const metaDup = dupByMeta as { id: string; parser_version: string | null } | null;
    if (metaDup?.id && metaDup.parser_version === PARSER_VERSION) {
      return duplicateResult(fileName, metaDup.id, emptyDebug, emptyStats);
    }

    const storagePath = `${effectiveUserId}/${Date.now()}-${fileName}`;
    const isHtmlSource = Boolean(extractedTextOverride) || /\.html?$/i.test(fileName);
    const uploadType = isHtmlSource ? 'text/html' : 'application/pdf';
    const blob = new Blob([new Uint8Array(arrayBuffer)], { type: uploadType });
    await supabaseClient.storage.from('crew-rosters').upload(storagePath, blob, { contentType: uploadType, upsert: true });

    let extractedText: string;
    if (extractedTextOverride !== undefined && extractedTextOverride.trim().length > 0) {
      extractedText = extractedTextOverride;
    } else {
      try {
        extractedText = await extractTextFromPdf(arrayBuffer);
      } catch (err) {
        return emptyResult(`Falha ao extrair texto do PDF: ${err instanceof Error ? err.message : 'erro'}`);
      }
    }

    if (!extractedText.trim()) {
      return emptyResult(isHtmlSource ? 'O HTML/texto extraído está vazio.' : 'O PDF não contém texto extraível.');
    }

    const header = parseHeader(extractedText);
    const normalized = normalizeCrewRosterPdfText(extractedText);
    const { entries: parsed, stats, textByDay, devUnrecognizedLines } = parseCrewRosterEntries(normalized);
    const entries = parsed.map(mapParsedToRosterEntry);

    if (import.meta.env.DEV) {
      console.log('Using parser:', PARSER_VERSION);
      console.log('PDF text length:', extractedText.length);
      console.log('RAW PDF TEXT:', extractedText.slice(0, 1000));
      console.log('Normalized text sample:', normalized.slice(0, 500));
      const flights = entries.filter((e) => e.isFlight);
      const activities = entries.filter((e) => !e.isFlight);
      console.log('Entries detected:', entries.length);
      console.log('Flights detected:', flights.length);
      console.log('Activities detected:', activities.length);
      console.log('Parsed entries:', entries);
    }

    if (import.meta.env.DEV && devUnrecognizedLines.length > 0) {
      console.debug('[pdf-import] parser diagnóstico:', devUnrecognizedLines);
    }

    const parseStats: ParseStats =
      entries.length > 0
        ? { ...stats, totalEntries: entries.length, totalAfterDedup: entries.length }
        : stats;

    if (entries.length === 0) {
      const devMsg =
        'PDF importado, mas nenhuma linha operacional foi reconhecida pelo parser. Verifique o texto extraído ou o formato.';
      if (import.meta.env.DEV) {
        console.warn('[pdf-import]', devMsg, { preview: extractedText.substring(0, 1200), stats });
      }
      return {
        success: false,
        header,
        parsedCount: 0,
        insertedCount: 0,
        rosterId: null,
        fileName,
        extractedTextPreview: extractedText.substring(0, 2000),
        parsedEntriesPreview: [],
        savedRowsPreview: [],
        debug: { ...emptyDebug, currentUserId: effectiveUserId },
        textByDay,
        parseStats,
        error: import.meta.env.DEV ? devMsg : 'Nenhum voo ou atividade identificado no PDF.',
      };
    }

    const isOfficialPdf = isOfficialCrewRosterFileName(fileName);

    // Desativa escalas ativas anteriores para ativar a nova importação.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deactivatedRows } = await (supabaseClient.from('imported_rosters') as any)
      .update({ is_active: false })
      .eq('user_id', effectiveUserId)
      .eq('is_active', true)
      .select('id');
    const deactivatedRosterIds = ((deactivatedRows as Array<{ id: string }> | null) ?? []).map((r) => r.id);

    // Create new roster
    const sourceMsg = isAutomationWorkerImport(importOrigin)
      ? `corp-automation-${importOrigin}-${Date.now()}`
      : `manual-upload-${Date.now()}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- automation_run_id ainda não está nos tipos gerados
    const { data: rosterRow, error: rosterError } = await (supabaseClient.from('imported_rosters') as any).insert({
      user_id: effectiveUserId,
      file_name: fileName,
      file_size_bytes: fileSizeBytes,
      content_sha256: contentSha256,
      source_message_id: sourceMsg,
      storage_path: storagePath,
      name: header.crewName || null,
      employee_code: header.employeeCode || null,
      crew_group_code: header.crewGroupCode || null,
      base_airport: header.baseAirport || null,
      crew_role: header.crewRole || null,
      roster_start_date: header.rosterStartDate || null,
      roster_end_date: header.rosterEndDate || null,
      flying_hours_total: header.flyingHoursTotal,
      duty_hours_total: header.dutyHoursTotal,
      raw_text_excerpt: extractedText.substring(0, 2000),
      parser_version: PARSER_VERSION,
      import_origin: importOrigin,
      roster_provider: isAutomationWorkerImport(importOrigin) ? 'corporate_portal' : 'pdf',
      source_type: isOfficialPdf ? 'official_pdf' : 'pdf',
      import_status: 'processing',
      parsed_count: entries.length,
      is_active: true,
      is_official_crew_roster_pdf: isOfficialPdf,
      ...(automationRunId ? { automation_run_id: automationRunId } : {}),
    }).select('id').single();

    if (rosterError) return emptyResult(`Erro ao criar roster: ${rosterError.message}`);
    const rosterId = rosterRow?.id || null;

    if (rosterId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: metaErr } = await (supabaseClient.from('imported_rosters') as any).update({
        roster_source: isAutomationWorkerImport(importOrigin) ? 'corporate_portal' : 'manual',
        roster_status: 'active',
      }).eq('id', rosterId);
      if (metaErr) {
        console.warn('[pdf-import] optional roster_source/roster_status skipped (apply migration)', metaErr.message);
      }
    }

    if (rosterId && deactivatedRosterIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseClient.from('imported_rosters') as any)
        .update({ superseded_by_roster_id: rosterId })
        .in('id', deactivatedRosterIds);
    }

    // Build rows
    const rows = entries.map(e => ({
      user_id: effectiveUserId,
      roster_id: rosterId,
      date: e.date,
      flight_number: e.flightNumber,
      departure: e.departureAirport || 'TBD',
      arrival: e.arrivalAirport || 'TBD',
      departure_time: e.departureTime || '00:00',
      arrival_time: e.arrivalTime || '00:00',
      status: 'scheduled',
      airline: 'LATAM',
      report_time: e.reportTime || null,
      duty_hours: e.dutyHours,
      activity_type: e.activityType,
      is_flight: e.isFlight,
      pairing_code: e.pairingCode || null,
      crew_role: e.crewRole || null,
      operation_type: e.operationType || null,
      departure_airport: e.departureAirport || null,
      arrival_airport: e.arrivalAirport || null,
      debrief_time: e.debriefTime || null,
      flight_hours: e.flightHours,
      aircraft_type: e.aircraftType || null,
      hotel_name: e.hotelName || null,
      assignment: e.assignment || null,
      comments: e.comments || null,
      raw_line: e.rawLine || null,
      source_pdf_path: storagePath,
      crosses_midnight: e.crossesMidnight,
      overnight: e.overnight,
      sort_datetime: e.sortDatetime || null,
      entry_type: e.entryType,
      crew_status_code: e.crewStatusCode || null,
      crew_status_label: e.crewStatusLabel || null,
      activity_label: e.activityLabel || null,
    }));

    const { rows: insertRows, removed: dedupeRemoved } = dedupeScheduleEntryRows(rows);
    if (import.meta.env.DEV && dedupeRemoved > 0) {
      console.warn(`[pdf-import] dedupe: ${dedupeRemoved} linha(s) repetida(s) removida(s) antes do insert`);
    }

    // Insert
    let insertedCount = 0;
    if (insertRows.length > 0) {
      if (import.meta.env.DEV) {
        console.log('INSERT PAYLOAD (first row sample):', insertRows[0]);
        console.log('INSERT PAYLOAD row count:', insertRows.length);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (supabaseClient.from('schedule_entries') as any).insert(insertRows);
      if (import.meta.env.DEV) {
        console.log('INSERT RESULT (bulk):', insertError ? 'failed' : 'ok', insertRows.length, 'rows');
        console.log('INSERT ERROR (bulk):', insertError);
      }
      if (insertError) {
        for (const row of insertRows) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: rowErr } = await (supabaseClient.from('schedule_entries') as any).insert([row]);
          if (import.meta.env.DEV && rowErr) {
            const isDup = (rowErr as { code?: string }).code === '23505';
            if (isDup) {
              console.warn('[pdf-import] insert ignorado (duplicata no banco):', row.flight_number, row.date);
            } else {
              console.error('INSERT ERROR (row):', rowErr, 'row sample:', row);
            }
          }
          if (!rowErr) insertedCount++;
        }
      } else {
        insertedCount = insertRows.length;
      }
    }

    // Update roster status
    const syncNow = new Date().toISOString();
    if (rosterId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseClient.from('imported_rosters') as any).update({
        import_status: insertedCount > 0 ? 'success' : 'error',
        inserted_count: insertedCount,
        import_error: insertedCount === 0 ? 'Falha ao inserir registros' : null,
        synced_at: insertedCount > 0 ? syncNow : null,
        last_sync_at: insertedCount > 0 ? syncNow : null,
        sync_status: insertedCount > 0 ? 'success' : 'error',
      }).eq('id', rosterId);
    }

    // Update profile
    if (header.crewName || header.baseAirport) {
      const updates: Record<string, unknown> = { airline: 'LATAM' };
      if (header.crewName) updates.name = header.crewName;
      await supabaseClient.from('profiles').update(updates).eq('user_id', effectiveUserId);
    }

    const connectionType: UserRosterConnectionType = isAutomationWorkerImport(importOrigin)
      ? 'corporate_pdf'
      : isOfficialPdf
        ? 'official_pdf'
        : 'corporate_pdf';
    if (rosterId && insertedCount > 0) {
      const nowIso = new Date().toISOString();
      const { data: existingConn } = await supabaseClient
        .from('user_roster_connection')
        .select('connected_at, is_auto_update_enabled')
        .eq('user_id', effectiveUserId)
        .maybeSingle();
      const ex = existingConn as { connected_at: string | null; is_auto_update_enabled: boolean } | null;
      await supabaseClient.from('user_roster_connection').upsert(
        {
          user_id: effectiveUserId,
          connection_type: connectionType,
          connection_status: 'connected',
          roster_connection_state: 'roster_connected',
          connected_at: ex?.connected_at ?? nowIso,
          last_checked_at: nowIso,
          last_successful_import_at: nowIso,
          current_active_roster_id: rosterId,
          last_error: null,
          is_auto_update_enabled: ex?.is_auto_update_enabled ?? true,
        },
        { onConflict: 'user_id' },
      );
    }

    const replaced = deactivatedRosterIds.length > 0;
    if (emitRosterEvent) {
      const { emitRosterUpdated } = await import('@/lib/events/roster-events');
      emitRosterUpdated({
        userId: effectiveUserId,
        reason: replaced ? 'roster_replaced' : isOfficialPdf ? 'official_pdf_import' : 'corporate_pdf_import',
        at: syncNow,
      });
    }

    // Fetch diagnostics
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: savedPreview } = await (supabaseClient.from('schedule_entries') as any)
      .select('date, flight_number, departure_airport, arrival_airport, departure_time, arrival_time, activity_type, is_flight, raw_line, aircraft_type, flight_hours, duty_hours, sort_datetime, entry_type, crew_status_code, crew_status_label, activity_label')
      .eq('user_id', effectiveUserId)
      .eq('roster_id', rosterId)
      .order('sort_datetime', { ascending: true })
      .limit(10);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: activeRosterData } = await (supabaseClient.from('imported_rosters') as any)
      .select('id, file_name, is_active, created_at')
      .eq('user_id', effectiveUserId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: activeCount } = await (supabaseClient.from('schedule_entries') as any)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', effectiveUserId)
      .eq('roster_id', rosterId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: oldCount } = await (supabaseClient.from('schedule_entries') as any)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', effectiveUserId)
      .neq('roster_id', rosterId);

    return {
      success: true,
      header,
      parsedCount: entries.length,
      insertedCount,
      rosterId,
      fileName,
      extractedTextPreview: extractedText.substring(0, 2000),
      parsedEntriesPreview: entries.slice(0, 10),
      savedRowsPreview: (savedPreview as Record<string, unknown>[]) || [],
      debug: {
        currentUserId: effectiveUserId,
        rosterId,
        deactivatedRosterIds,
        activeRoster: (activeRosterData as { id: string; file_name: string | null; is_active: boolean; created_at: string } | null) ?? null,
        totalRowsActiveRoster: activeCount ?? 0,
        totalRowsOldRosters: oldCount ?? 0,
      },
      textByDay,
      parseStats,
      error: null,
    };
  } catch (err) {
    return emptyResult(err instanceof Error ? err.message : 'Erro desconhecido');
  }
}

export async function importPdfFile(file: File, userId: string): Promise<PdfImportResult> {
  const arrayBuffer = await file.arrayBuffer();
  return importPdfArrayBuffer(file.name, arrayBuffer, userId);
}
