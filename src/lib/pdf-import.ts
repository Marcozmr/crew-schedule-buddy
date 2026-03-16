import { supabase } from '@/integrations/supabase/client';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const PARSER_VERSION = '3.0-latam-iflight';

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
  date: string;            // YYYY-MM-DD
  activityType: string;    // flight | DO | HSB | ASB | HSBE | APR | etc
  isFlight: boolean;
  flightNumber: string;
  pairingCode: string;
  crewRole: string;
  operationType: string;   // OP | PS
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
  sortDatetime: string;    // ISO string for sorting
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
  error: string | null;
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

/** Parse DD-MMM-YYYY → YYYY-MM-DD */
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

// ── Header Parser ──────────────────────────────────────

function parseHeader(text: string): RosterHeader {
  const header: RosterHeader = {
    crewName: '', employeeCode: '', crewGroupCode: '', baseAirport: '', crewRole: '',
    rosterStartDate: '', rosterEndDate: '',
    flyingHoursTotal: null, dutyHoursTotal: null,
  };

  const nameMatch = text.match(/(?:Name|Crew|Tripulante)[:\s]+([A-Z][A-Za-zÀ-ÿ\s,.-]+)/i);
  if (nameMatch) header.crewName = nameMatch[1].trim();

  const empMatch = text.match(/(?:Emp(?:loyee)?|Matr[ií]cula|Code)[:\s#]*(\d{4,8})/i);
  if (empMatch) header.employeeCode = empMatch[1];

  // Crew group code e.g. JJCC320
  const groupMatch = text.match(/\b(JJ[A-Z]{2}\d{3})\b/i);
  if (groupMatch) header.crewGroupCode = groupMatch[1].toUpperCase();

  const baseMatch = text.match(/(?:Base|Home\s?Base)[:\s]+([A-Z]{3})/i);
  if (baseMatch) header.baseAirport = baseMatch[1].toUpperCase();

  const roleMatch = text.match(/(?:Rank|Fun[çc][ãa]o|Position|Crew\s?Role)[:\s]+([A-Z]{2,5})/i);
  if (roleMatch) header.crewRole = roleMatch[1].toUpperCase();

  // Roster period
  const periodMatch = text.match(/(\d{1,2}[\s\-][A-Z]{3}[\s\-]\d{2,4})\s*(?:[-–to]+)\s*(\d{1,2}[\s\-][A-Z]{3}[\s\-]\d{2,4})/i);
  if (periodMatch) {
    header.rosterStartDate = parseRosterDate(periodMatch[1]) || periodMatch[1];
    header.rosterEndDate = parseRosterDate(periodMatch[2]) || periodMatch[2];
  }

  const fhMatch = text.match(/(?:Flying|Flight)\s*(?:Hours?|Hrs?|Time)[:\s]*(\d+[.:]\d{1,2})/i);
  if (fhMatch) header.flyingHoursTotal = parseHoursMinutes(fhMatch[1]);

  const dhMatch = text.match(/(?:Duty)\s*(?:Hours?|Hrs?|Time)[:\s]*(\d+[.:]\d{1,2})/i);
  if (dhMatch) header.dutyHoursTotal = parseHoursMinutes(dhMatch[1]);

  return header;
}

function parseHoursMinutes(val: string): number {
  const parts = val.split(/[.:]/);
  const h = parseInt(parts[0]) || 0;
  const m = parseInt(parts[1]) || 0;
  return Math.round((h + m / 60) * 10) / 10;
}

// ── Non-flight activity codes ──────────────────────────

const NON_FLIGHT_CODES = new Set([
  'DO', 'X', 'OFF', 'HSB', 'HSBE', 'SBY', 'ASB', 'APR', 'TRN', 'SIM', 'GND',
  'REC', 'VAC', 'LIC', 'FER', 'ADM', 'RES', 'RSV', 'AVL', 'DHD', 'DH',
  'FOLGA', 'CURSO', 'CKT', 'CK', 'REP', 'REST',
]);

// codes that should NEVER be treated as IATA airports
const EXCLUDE_IATA = new Set([
  ...NON_FLIGHT_CODES,
  'STD', 'STA', 'ETD', 'ETA', 'BLK', 'FLT', 'ACT', 'PAX', 'UTC', 'GMT',
  'LCL', 'RPT', 'REL', 'TOT', 'NET', 'JAN', 'FEB', 'MAR', 'APR', 'MAY',
  'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'FEV', 'ABR', 'MAI',
  'AGO', 'SET', 'OUT', 'DEZ', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN',
]);

// ── Entry Parser ───────────────────────────────────────

function parseEntries(text: string): RosterEntry[] {
  const entries: RosterEntry[] = [];
  const normalized = text.replace(/\t/g, ' ').replace(/\r/g, '\n');

  // Find all date-prefixed sections
  const dateRegex = /(?:^|\n|\s{2,})(\d{1,2}[\s\-][A-Z]{3}[\s\-]\d{2,4})\b/gi;
  const datePositions: { date: string; pos: number }[] = [];

  let dm;
  while ((dm = dateRegex.exec(normalized)) !== null) {
    const parsed = parseRosterDate(dm[1]);
    if (parsed) {
      datePositions.push({ date: parsed, pos: dm.index });
    }
  }

  for (let i = 0; i < datePositions.length; i++) {
    const start = datePositions[i].pos;
    const end = i + 1 < datePositions.length ? datePositions[i + 1].pos : normalized.length;
    const segment = normalized.substring(start, end).replace(/\n/g, ' ').trim();
    const date = datePositions[i].date;

    // Check for flights (LAxxxx)
    const flightMatches = [...segment.matchAll(/\b(LA\d{3,5})\b/gi)];
    // Check for non-flight codes
    const nonFlightMatch = segment.match(
      /\b(DO|HSB|HSBE|ASB|APR|SBY|OFF|X|TRN|SIM|GND|REC|VAC|LIC|FER|ADM|RES|RSV|AVL|DHD|DH|FOLGA|CURSO|CKT|CK|REP|REST)\b/i
    );

    if (flightMatches.length > 0) {
      for (const fm of flightMatches) {
        const flightNumber = fm[1].toUpperCase();
        const flightIdx = fm.index!;
        const nextFlight = flightMatches.find(f => f.index! > flightIdx);
        const flightEnd = nextFlight ? nextFlight.index! : segment.length;
        const flightContext = segment.substring(flightIdx, flightEnd);
        const fullContext = segment.substring(0, flightEnd);

        const entry = parseFlightLine(date, flightNumber, flightContext, fullContext, segment);
        entries.push(entry);
      }
    } else if (nonFlightMatch) {
      const code = nonFlightMatch[1].toUpperCase();
      entries.push({
        date,
        activityType: code,
        isFlight: false,
        flightNumber: code,
        pairingCode: extractPairingCode(segment),
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
        hotelName: extractHotel(segment),
        assignment: '',
        comments: '',
        rawLine: segment.substring(0, 250),
        crossesMidnight: false,
        overnight: false,
        sortDatetime: `${date}T00:00:00`,
      });
    }
  }

  return entries;
}

function parseFlightLine(
  date: string,
  flightNumber: string,
  context: string,
  fullContext: string,
  rawLine: string
): RosterEntry {
  // Extract airports: 3-letter IATA codes
  const airports = [...context.matchAll(/\b([A-Z]{3})\b/g)]
    .map(m => m[1])
    .filter(code => !EXCLUDE_IATA.has(code) && !/^LA\d/.test(code) && code !== flightNumber.substring(0, 3));

  const departureAirport = airports[0] || '';
  const arrivalAirport = airports[1] || '';

  // Extract times: HH:MM patterns
  const times = [...context.matchAll(/\b(\d{1,2}):(\d{2})\b/g)].map(m => `${m[1].padStart(2, '0')}:${m[2]}`);
  // Also match HHMM format (4 digits not part of flight number or year)
  const hhmm = [...context.matchAll(/(?<![A-Z\d])(\d{4})(?!\d)/g)]
    .map(m => m[1])
    .filter(v => {
      const h = parseInt(v.substring(0, 2));
      const min = parseInt(v.substring(2));
      return h >= 0 && h <= 23 && min >= 0 && min <= 59 && parseInt(v) > 100;
    })
    .map(v => `${v.substring(0, 2)}:${v.substring(2)}`);

  const allTimes = [...times, ...hhmm];

  // Typical order: report, departure, arrival, debrief
  const reportTime = allTimes.length >= 3 ? allTimes[0] : '';
  const departureTime = allTimes.length >= 3 ? allTimes[1] : allTimes[0] || '';
  const arrivalTime = allTimes.length >= 3 ? allTimes[2] : allTimes[1] || '';
  const debriefTime = allTimes.length >= 4 ? allTimes[3] : '';

  // Check (+1) for midnight crossing
  const crossesMidnight = /\(\+1\)/.test(context);

  // Operation type OP/PS
  const opMatch = context.match(/\b(OP|PS)\b/i);
  const operationType = opMatch ? opMatch[1].toUpperCase() : '';

  // Calculate flight hours
  let flightHours: number | null = null;
  if (departureTime && arrivalTime) {
    const [dh, dm_] = departureTime.split(':').map(Number);
    const [ah, am] = arrivalTime.split(':').map(Number);
    let diff = (ah * 60 + am) - (dh * 60 + dm_);
    if (diff < 0 || crossesMidnight) diff += 1440;
    flightHours = Math.round((diff / 60) * 10) / 10;
  }

  // Calculate duty hours (report to debrief or report to arrival + 30min)
  let dutyHours: number | null = null;
  const dutyStart = reportTime || departureTime;
  const dutyEnd = debriefTime || arrivalTime;
  if (dutyStart && dutyEnd) {
    const [sh, sm] = dutyStart.split(':').map(Number);
    const [eh, em] = dutyEnd.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0 || crossesMidnight) diff += 1440;
    if (!debriefTime && arrivalTime) diff += 30;
    dutyHours = Math.round((diff / 60) * 10) / 10;
  }

  // Extract aircraft type
  const acMatch = context.match(/\b(A3[12]\d|A320|A321|A319|A330|A340|A350|A380|B7[3-8]\d|B737|B738|B767|B777|B787|B747|E1[79]\d|E190|E195|ATR\s?\d{2})\b/i);
  const aircraftType = acMatch ? acMatch[1].toUpperCase() : '';

  const sortDatetime = departureTime ? `${date}T${departureTime}:00` : `${date}T00:00:00`;

  return {
    date,
    activityType: 'flight',
    isFlight: true,
    flightNumber,
    pairingCode: extractPairingCode(fullContext),
    crewRole: extractCrewRole(fullContext),
    operationType,
    reportTime,
    departureAirport,
    departureTime,
    arrivalAirport,
    arrivalTime,
    debriefTime,
    flightHours,
    dutyHours,
    aircraftType,
    hotelName: extractHotel(rawLine),
    assignment: '',
    comments: '',
    rawLine: rawLine.substring(0, 250),
    crossesMidnight,
    overnight: crossesMidnight || !!extractHotel(rawLine),
    sortDatetime,
  };
}

function extractPairingCode(text: string): string {
  // Pairing codes: 4-6 alphanumeric, NOT a flight number, NOT a date component
  const m = text.match(/\b([A-Z]\d{3,5})\b/);
  if (m && !/^LA\d/.test(m[1])) return m[1];
  return '';
}

function extractCrewRole(text: string): string {
  const m = text.match(/\b(CA|FO|SO|CM|CC|FA|PUR|INS|CHK|OBS|CCP|TCA|TCP)\b/i);
  return m ? m[1].toUpperCase() : '';
}

function extractHotel(text: string): string {
  const m = text.match(/(?:Hotel|HTL|Pernoite|HTLX?)[:\s]+([^\n,;]{3,40})/i);
  return m ? m[1].trim() : '';
}

// ── Main import function ───────────────────────────────

export async function importPdfFile(file: File, userId: string): Promise<PdfImportResult> {
  const fileName = file.name;
  const emptyResult = (error: string, currentUserId: string): PdfImportResult => ({
    success: false,
    header: null,
    parsedCount: 0,
    insertedCount: 0,
    rosterId: null,
    fileName,
    extractedTextPreview: '',
    parsedEntriesPreview: [],
    savedRowsPreview: [],
    debug: {
      currentUserId,
      rosterId: null,
      deactivatedRosterIds: [],
      activeRoster: null,
      totalRowsActiveRoster: 0,
      totalRowsOldRosters: 0,
    },
    error,
  });

  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const effectiveUserId = authUser?.id || userId;

    // 1. Read file
    const arrayBuffer = await file.arrayBuffer();

    // 2. Upload to storage
    const storagePath = `${effectiveUserId}/${Date.now()}-${fileName}`;
    const blob = new Blob([new Uint8Array(arrayBuffer)], { type: 'application/pdf' });
    await supabase.storage.from('crew-rosters').upload(storagePath, blob, { contentType: 'application/pdf', upsert: true });

    // 3. Extract text
    let extractedText: string;
    try {
      extractedText = await extractTextFromPdf(arrayBuffer);
    } catch (err) {
      return emptyResult(`Falha ao extrair texto do PDF: ${err instanceof Error ? err.message : 'erro'}`, effectiveUserId);
    }

    if (!extractedText.trim()) {
      return emptyResult('O PDF não contém texto extraível. Pode ser um PDF de imagem (escaneado).', effectiveUserId);
    }

    // 4. Parse header
    const header = parseHeader(extractedText);

    // 5. Parse entries
    const entries = parseEntries(extractedText);
    if (entries.length === 0) {
      return {
        success: false,
        header,
        parsedCount: 0,
        insertedCount: 0,
        rosterId: null,
        fileName,
        extractedTextPreview: extractedText.substring(0, 1000),
        parsedEntriesPreview: [],
        savedRowsPreview: [],
        debug: {
          currentUserId: effectiveUserId,
          rosterId: null,
          deactivatedRosterIds: [],
          activeRoster: null,
          totalRowsActiveRoster: 0,
          totalRowsOldRosters: 0,
        },
        error: 'Nenhum voo ou atividade identificado no PDF.',
      };
    }

    // 6. Deactivate previous rosters
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deactivatedRows } = await (supabase.from('imported_rosters') as any)
      .update({ is_active: false })
      .eq('user_id', effectiveUserId)
      .eq('is_active', true)
      .select('id');

    const deactivatedRosterIds = ((deactivatedRows as Array<{ id: string }> | null) ?? []).map((r) => r.id);

    // 7. Create imported_rosters record as ACTIVE
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
      import_status: 'processing',
      parsed_count: entries.length,
      is_active: true,
    }).select('id').single();

    if (rosterError) {
      return emptyResult(`Erro ao criar roster: ${rosterError.message}`, effectiveUserId);
    }

    const rosterId = rosterRow?.id || null;

    // 8. Build rows (mantém histórico antigo, sem apagar)
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

    // 9. Insert
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

    // 10. Update roster status
    if (rosterId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('imported_rosters') as any).update({
        import_status: insertedCount > 0 ? 'success' : 'error',
        inserted_count: insertedCount,
        import_error: insertedCount === 0 ? 'Falha ao inserir registros' : null,
      }).eq('id', rosterId);
    }

    // 11. Update profile
    if (header.crewName || header.baseAirport) {
      const updates: Record<string, unknown> = { airline: 'LATAM' };
      if (header.crewName) updates.name = header.crewName;
      await supabase.from('profiles').update(updates).eq('user_id', effectiveUserId);
    }

    // 12. Fetch diagnostics
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
      extractedTextPreview: extractedText.substring(0, 1000),
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
      error: null,
    };
  } catch (err) {
    return emptyResult(err instanceof Error ? err.message : 'Erro desconhecido', userId);
  }
}
