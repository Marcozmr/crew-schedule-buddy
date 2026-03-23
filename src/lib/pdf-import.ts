import { supabase } from '@/integrations/supabase/client';
import { emitRosterUpdated } from '@/lib/events/roster-events';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const PARSER_VERSION = '4.0-latam-iflight';

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

export interface ParseStats {
  totalRawAnchors: number;
  totalFlights: number;
  totalDO: number;
  totalStandby: number;
  totalAPR: number;
  totalAfterDedup: number;
}

// ── PDF Text Extraction ────────────────────────────────

async function extractTextFromPdf(pdfBytes: ArrayBuffer): Promise<string> {
  const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const chunks: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items
      .map(item => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText) chunks.push(pageText);
  }
  return chunks.join('\n');
}

// ── Month name map ─────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
  FEV: '02', ABR: '04', MAI: '05', AGO: '08', SET: '09', OUT: '10', DEZ: '12',
};

function parseRosterDate(raw: string): string | null {
  const m = raw.match(/(\d{1,2})[\s\-]([A-Z]{3})[\s\-](\d{2,4})/i);
  if (!m) return null;
  const day = m[1].padStart(2, '0');
  const monthKey = m[2].toUpperCase();
  const month = MONTH_MAP[monthKey];
  if (!month) return null;
  let year = m[3];
  if (year.length === 2) year = `20${year}`;
  return `${year}-${month}-${day}`;
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

  const periodMatch = text.match(/(\d{1,2}[\s\-][A-Z]{3}[\s\-]\d{2,4})\s*(?:[-–to]+)\s*(\d{1,2}[\s\-][A-Z]{3}[\s\-]\d{2,4})/i);
  if (periodMatch) {
    header.rosterStartDate = parseRosterDate(periodMatch[1]) || periodMatch[1];
    header.rosterEndDate = parseRosterDate(periodMatch[2]) || periodMatch[2];
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

// ── CREW ROLES for regex ───────────────────────────────
const CREW_ROLES = 'CC|CA|FO|SO|CM|FA|PUR|INS|CHK|OBS|CCP|TCA|TCP';

// ── Non-flight codes ──────────────────────────────────
const NON_FLIGHT_CODES = ['DO', 'HSB', 'HSBE', 'ASB', 'APR', 'OFF', 'SBY', 'X', 'TRN', 'SIM', 'GND', 'REC', 'VAC', 'LIC', 'FER', 'ADM', 'RES', 'RSV', 'AVL', 'FOLGA', 'CURSO', 'REST'];
const STANDBY_CODES = new Set(['HSB', 'HSBE', 'ASB', 'SBY']);
const DAYOFF_CODES = new Set(['DO', 'OFF', 'FOLGA', 'X']);

// ── Aircraft pattern ──────────────────────────────────
const AIRCRAFT_RE = /^(319|320|321|330|340|350|380|737|738|747|757|767|777|787|E\d{2,3})$/i;

// ── Entry Parser v4 ───────────────────────────────────

function parseEntries(text: string): { entries: RosterEntry[]; stats: ParseStats; textByDay: Record<string, string> } {
  const normalized = text.replace(/\r\n?/g, ' ').replace(/\s+/g, ' ');

  // Step 1: Find all date positions for lookback
  const dateRegex = /(\d{1,2}-[A-Z]{3}-\d{4})/gi;
  const datePositions: { date: string; pos: number }[] = [];
  let dm;
  while ((dm = dateRegex.exec(normalized)) !== null) {
    const parsed = parseRosterDate(dm[1]);
    if (parsed) datePositions.push({ date: parsed, pos: dm.index });
  }

  function getDateForPosition(pos: number): string {
    let best = '';
    for (const dp of datePositions) {
      if (dp.pos <= pos) best = dp.date;
      else break;
    }
    return best;
  }

  // Step 2: Group raw text by day for debug
  const textByDay: Record<string, string> = {};
  for (let i = 0; i < datePositions.length; i++) {
    const start = datePositions[i].pos;
    const end = i + 1 < datePositions.length ? datePositions[i + 1].pos : normalized.length;
    const segment = normalized.substring(start, end).trim();
    const date = datePositions[i].date;
    if (textByDay[date]) {
      textByDay[date] += ' | ' + segment;
    } else {
      textByDay[date] = segment;
    }
  }

  const entries: RosterEntry[] = [];
  let totalRawAnchors = 0;

  // Step 3: Find ALL flights using the definitive pattern:
  // LAxxxx ROLE (OP|PS) APT HH:MM APT HH:MM
  // This only matches the Item column occurrence, NOT pairing codes (which have slashes)
  const flightRegex = new RegExp(
    `(LA\\d{3,5})\\s+(${CREW_ROLES})\\s+(OP|PS)\\s+([A-Z]{3})\\s+(\\d{2}:\\d{2})\\s+([A-Z]{3})\\s+(\\d{2}:\\d{2})`,
    'gi'
  );

  let fm;
  while ((fm = flightRegex.exec(normalized)) !== null) {
    totalRawAnchors++;
    const matchPos = fm.index;
    const matchEnd = matchPos + fm[0].length;
    const date = getDateForPosition(matchPos);
    if (!date) continue;

    const flightNumber = fm[1].toUpperCase();
    const crewRole = fm[2].toUpperCase();
    const operationType = fm[3].toUpperCase();
    const depAirport = fm[4].toUpperCase();
    const depTime = fm[5];
    const arrAirport = fm[6].toUpperCase();
    const arrTime = fm[7];

    // Get report time: look for HH:MM immediately before the flight number
    const beforeFlight = normalized.substring(Math.max(0, matchPos - 8), matchPos);
    const reportMatch = beforeFlight.match(/(\d{2}:\d{2})\s+$/);
    const reportTime = reportMatch ? reportMatch[1] : '';

    // Parse remaining tokens after arrival time until next anchor
    const afterMatch = normalized.substring(matchEnd, Math.min(matchEnd + 80, normalized.length));
    const tokens = afterMatch.trim().split(/\s+/);

    let crossesMidnight = false;
    const clockTimes: string[] = [];
    const durationTimes: string[] = [];
    let aircraftType = '';
    let idx = 0;

    // Check (+1) right after arr_time
    if (tokens[idx] === '(+1)') {
      crossesMidnight = true;
      idx++;
    }

    while (idx < tokens.length) {
      const t = tokens[idx];
      if (/^\d{2}:\d{2}$/.test(t)) {
        if (idx + 1 < tokens.length && tokens[idx + 1] === '(+1)') {
          clockTimes.push(t);
          crossesMidnight = true;
          idx += 2;
        } else {
          durationTimes.push(t);
          idx++;
        }
      } else if (AIRCRAFT_RE.test(t)) {
        aircraftType = t;
        break;
      } else if (/^\d{1,2}-[A-Z]{3}-\d{4}$/i.test(t)) {
        break;
      } else if (/^LA\d{3,5}$/i.test(t)) {
        break;
      } else if (NON_FLIGHT_CODES.includes(t.toUpperCase())) {
        break;
      } else {
        idx++;
      }
    }

    // Classify times
    let debriefTime = '';
    let flightHours: number | null = null;
    let dutyHours: number | null = null;

    // Clock times with (+1) are debrief
    if (clockTimes.length > 0) {
      debriefTime = clockTimes[clockTimes.length - 1];
    }

    // For duration times: distinguish debrief (clock) from FH (duration)
    if (durationTimes.length >= 2 && !debriefTime) {
      // Check if first duration is actually a debrief (close to and after arr_time)
      const arrMinutes = timeToMinutes(arrTime);
      const firstMinutes = timeToMinutes(durationTimes[0]);
      const diff = firstMinutes - arrMinutes;
      if (diff >= 0 && diff <= 120) {
        // First time is debrief (within 2h after arrival, same day)
        debriefTime = durationTimes[0];
        flightHours = parseHoursMinutes(durationTimes[1]);
        dutyHours = durationTimes.length > 2 ? parseHoursMinutes(durationTimes[2]) : null;
      } else {
        flightHours = parseHoursMinutes(durationTimes[0]);
        dutyHours = parseHoursMinutes(durationTimes[1]);
      }
    } else if (durationTimes.length === 1) {
      flightHours = parseHoursMinutes(durationTimes[0]);
    } else if (durationTimes.length >= 2 && debriefTime) {
      flightHours = parseHoursMinutes(durationTimes[0]);
      dutyHours = durationTimes.length > 1 ? parseHoursMinutes(durationTimes[1]) : null;
    }

    // For passive flights (PS), flight_hours should be 0
    if (operationType === 'PS' && flightHours === 0) {
      // Keep 0, it's correct for passive
    }

    const sortDatetime = `${date}T${depTime}:00`;

    entries.push({
      date,
      activityType: 'flight',
      isFlight: true,
      flightNumber,
      pairingCode: '',
      crewRole,
      operationType,
      reportTime,
      departureAirport: depAirport,
      departureTime: depTime,
      arrivalAirport: arrAirport,
      arrivalTime: arrTime,
      debriefTime,
      flightHours,
      dutyHours,
      aircraftType,
      hotelName: '',
      assignment: '',
      comments: '',
      rawLine: normalized.substring(matchPos, Math.min(matchPos + 120, normalized.length)),
      crossesMidnight,
      overnight: crossesMidnight,
      sortDatetime,
    });
  }

  // Step 4: Find non-flight activities
  // Match standalone DO/HSB/ASB/HSBE/APR NOT part of pairing codes (no -/ after)
  const nonFlightCodes = NON_FLIGHT_CODES.join('|');
  const nfRegex = new RegExp(`\\b(${nonFlightCodes})\\b(?![\\/-])`, 'gi');
  let nfm;
  while ((nfm = nfRegex.exec(normalized)) !== null) {
    const code = nfm[1].toUpperCase();
    const pos = nfm.index;

    // Skip if preceded by slash or hyphen (part of pairing like ASB-20/ or LA3953/)
    const charBefore = pos > 0 ? normalized[pos - 1] : ' ';
    if (charBefore === '/' || charBefore === '-') continue;

    // Skip if this is within a flight match context (e.g., "APR" month in dates)
    // Check: is this followed by date-like pattern? (DD-APR-YYYY)
    const charAfter = pos + code.length < normalized.length ? normalized[pos + code.length] : ' ';
    if (charAfter === '-') continue; // Part of date like "01-APR-2026"

    // Skip column header occurrences
    const before20 = normalized.substring(Math.max(0, pos - 20), pos).toLowerCase();
    if (before20.includes('assignment') || before20.includes('comments') || before20.includes('hotel')) continue;

    const date = getDateForPosition(pos);
    if (!date) continue;

    totalRawAnchors++;

    entries.push({
      date,
      activityType: code,
      isFlight: false,
      flightNumber: code,
      pairingCode: '',
      crewRole: '',
      operationType: '',
      reportTime: '',
      departureAirport: '',
      departureTime: '',
      arrivalAirport: '',
      arrivalTime: '',
      debriefTime: '',
      flightHours: null,
      dutyHours: null,
      aircraftType: '',
      hotelName: '',
      assignment: '',
      comments: '',
      rawLine: normalized.substring(pos, Math.min(pos + 80, normalized.length)),
      crossesMidnight: false,
      overnight: false,
      sortDatetime: `${date}T00:00:00`,
    });
  }

  // Step 5: Deduplicate
  const deduped = deduplicateEntries(entries);

  // Stats
  const stats: ParseStats = {
    totalRawAnchors,
    totalFlights: deduped.filter(e => e.isFlight).length,
    totalDO: deduped.filter(e => DAYOFF_CODES.has(e.activityType)).length,
    totalStandby: deduped.filter(e => STANDBY_CODES.has(e.activityType)).length,
    totalAPR: deduped.filter(e => e.activityType === 'APR').length,
    totalAfterDedup: deduped.length,
  };

  return { entries: deduped, stats, textByDay };
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function deduplicateEntries(entries: RosterEntry[]): RosterEntry[] {
  const seen = new Set<string>();
  return entries.filter(e => {
    const key = `${e.date}|${e.activityType}|${e.flightNumber}|${e.departureAirport}|${e.departureTime}|${e.arrivalAirport}|${e.arrivalTime}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Main import function ───────────────────────────────

export async function importPdfFile(file: File, userId: string): Promise<PdfImportResult> {
  const fileName = file.name;
  const emptyDebug: ImportDebugInfo = { currentUserId: userId, rosterId: null, deactivatedRosterIds: [], activeRoster: null, totalRowsActiveRoster: 0, totalRowsOldRosters: 0 };
  const emptyStats: ParseStats = { totalRawAnchors: 0, totalFlights: 0, totalDO: 0, totalStandby: 0, totalAPR: 0, totalAfterDedup: 0 };
  const emptyResult = (error: string): PdfImportResult => ({
    success: false, header: null, parsedCount: 0, insertedCount: 0, rosterId: null, fileName,
    extractedTextPreview: '', parsedEntriesPreview: [], savedRowsPreview: [],
    debug: { ...emptyDebug }, textByDay: {}, parseStats: emptyStats, error,
  });

  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const effectiveUserId = authUser?.id || userId;

    const arrayBuffer = await file.arrayBuffer();
    const storagePath = `${effectiveUserId}/${Date.now()}-${fileName}`;
    const blob = new Blob([new Uint8Array(arrayBuffer)], { type: 'application/pdf' });
    await supabase.storage.from('crew-rosters').upload(storagePath, blob, { contentType: 'application/pdf', upsert: true });

    let extractedText: string;
    try {
      extractedText = await extractTextFromPdf(arrayBuffer);
    } catch (err) {
      return emptyResult(`Falha ao extrair texto do PDF: ${err instanceof Error ? err.message : 'erro'}`);
    }

    if (!extractedText.trim()) {
      return emptyResult('O PDF não contém texto extraível.');
    }

    const header = parseHeader(extractedText);
    const { entries, stats, textByDay } = parseEntries(extractedText);

    if (entries.length === 0) {
      return {
        success: false, header, parsedCount: 0, insertedCount: 0, rosterId: null, fileName,
        extractedTextPreview: extractedText.substring(0, 2000), parsedEntriesPreview: [], savedRowsPreview: [],
        debug: { ...emptyDebug, currentUserId: effectiveUserId }, textByDay, parseStats: stats,
        error: 'Nenhum voo ou atividade identificado no PDF.',
      };
    }

    // Regra de precedência: portal > manual.
    // Manual só fica ativa se não houver portal ativo.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: portalActiveRows } = await (supabase.from('imported_rosters') as any)
      .select('id')
      .eq('user_id', effectiveUserId)
      .eq('is_active', true)
      .or('import_origin.eq.portal,portal_connection_id.not.is.null');

    const shouldActivateManual = !portalActiveRows?.length;
    let deactivatedRosterIds: string[] = [];
    if (shouldActivateManual) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: deactivatedRows } = await (supabase.from('imported_rosters') as any)
        .update({ is_active: false })
        .eq('user_id', effectiveUserId)
        .eq('is_active', true)
        .select('id');
      deactivatedRosterIds = ((deactivatedRows as Array<{ id: string }> | null) ?? []).map(r => r.id);
    }

    // Create new roster
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rosterRow, error: rosterError } = await (supabase.from('imported_rosters') as any).insert({
      user_id: effectiveUserId,
      file_name: fileName,
      source_message_id: `manual-upload-${Date.now()}`,
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
      import_origin: 'manual',
      import_status: 'processing',
      parsed_count: entries.length,
      is_active: shouldActivateManual,
    }).select('id').single();

    if (rosterError) return emptyResult(`Erro ao criar roster: ${rosterError.message}`);
    const rosterId = rosterRow?.id || null;

    if (rosterId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: metaErr } = await (supabase.from('imported_rosters') as any).update({
        roster_source: 'manual',
        roster_status: shouldActivateManual ? 'active' : 'archived',
      }).eq('id', rosterId);
      if (metaErr) {
        console.warn('[pdf-import] optional roster_source/roster_status skipped (apply migration)', metaErr.message);
      }
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
    }));

    // Insert
    let insertedCount = 0;
    if (rows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (supabase.from('schedule_entries') as any).insert(rows);
      if (insertError) {
        for (const row of rows) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase.from('schedule_entries') as any).insert([row]);
          if (!error) insertedCount++;
        }
      } else {
        insertedCount = rows.length;
      }
    }

    // Update roster status
    if (rosterId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('imported_rosters') as any).update({
        import_status: insertedCount > 0 ? 'success' : 'error',
        inserted_count: insertedCount,
        import_error: insertedCount === 0 ? 'Falha ao inserir registros' : null,
      }).eq('id', rosterId);
    }

    // Update profile
    if (header.crewName || header.baseAirport) {
      const updates: Record<string, unknown> = { airline: 'LATAM' };
      if (header.crewName) updates.name = header.crewName;
      await supabase.from('profiles').update(updates).eq('user_id', effectiveUserId);
    }

    emitRosterUpdated({
      userId: effectiveUserId,
      reason: 'manual_import',
      at: new Date().toISOString(),
    });

    // Fetch diagnostics
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: savedPreview } = await (supabase.from('schedule_entries') as any)
      .select('date, flight_number, departure_airport, arrival_airport, departure_time, arrival_time, activity_type, is_flight, raw_line, aircraft_type, flight_hours, duty_hours, sort_datetime')
      .eq('user_id', effectiveUserId)
      .eq('roster_id', rosterId)
      .order('sort_datetime', { ascending: true })
      .limit(10);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: activeRosterData } = await (supabase.from('imported_rosters') as any)
      .select('id, file_name, is_active, created_at')
      .eq('user_id', effectiveUserId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: activeCount } = await (supabase.from('schedule_entries') as any)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', effectiveUserId)
      .eq('roster_id', rosterId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: oldCount } = await (supabase.from('schedule_entries') as any)
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
      parseStats: stats,
      error: null,
    };
  } catch (err) {
    return emptyResult(err instanceof Error ? err.message : 'Erro desconhecido');
  }
}
