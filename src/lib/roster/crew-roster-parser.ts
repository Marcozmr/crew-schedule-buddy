/**
 * Parser CrewRosterReport LATAM — texto extraído do PDF (pdf.js), sem OCR.
 * Normaliza datas DD-Mmm-YYYY (mês com maiúscula/minúscula) e detecta voos por padrão LA####.
 */

import {
  resolveCrewStatusFromActivityCode,
  resolveCrewStatusFromFlightOperation,
  KNOWN_ACTIVITY_CODES,
  BASE_SUFFIXED_TOKENS,
  type NormalizedEntryType,
} from '@/lib/roster/crew-status-labels';

/** Versão única do parser — alinhar com `parser_version` em pdf-import. */
/** V6: reconhece todas as siglas iFlight Neo (antes só 13 hardcoded) + corrige ASB/HSB trocados. */
export const PARSER_VERSION = 'LATAM_ROSTER_V6';

const MONTH_MAP: Record<string, string> = {
  JAN: '01',
  FEB: '02',
  MAR: '03',
  APR: '04',
  MAY: '05',
  JUN: '06',
  JUL: '07',
  AUG: '08',
  SEP: '09',
  OCT: '10',
  NOV: '11',
  DEC: '12',
  FEV: '02',
  ABR: '04',
  MAI: '05',
  AGO: '08',
  SET: '09',
  OUT: '10',
  DEZ: '12',
};

export interface CrewRosterParseStats {
  /** Igual ao número de entradas após dedupe — use na UI como “total”. */
  totalEntries: number;
  totalRawAnchors: number;
  totalFlights: number;
  totalDO: number;
  totalStandby: number;
  totalAPR: number;
  totalReserve: number;
  totalOnCall: number;
  totalPresentation: number;
  totalAfterDedup: number;
  unrecognizedSnippetCount: number;
}

export interface CrewRosterParsedEntry {
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
  entryType: NormalizedEntryType;
  crewStatusCode: string;
  crewStatusLabel: string;
  activityLabel: string;
}

const CREW_ROLES =
  'CC|CA|FO|SO|CM|FA|PUR|INS|CHK|OBS|CCP|TCA|TCP|CCM';

/**
 * Todos os códigos de atividade (não-voo) reconhecidos — vem da tabela oficial de siglas
 * iFlight Neo (crew-status-labels.ts), não de uma lista curta manual. Sem isto, dias inteiros da
 * escala (treinamento, férias, folga pedida, artigos perigosos etc.) somem silenciosamente da
 * importação por não estarem numa whitelist. Ordenado por tamanho decrescente pra evitar que um
 * código menor "roube" o match de um maior no motor de regex.
 */
const NON_FLIGHT_TOKEN = [...KNOWN_ACTIVITY_CODES, ...BASE_SUFFIXED_TOKENS]
  .sort((a, b) => b.length - a.length)
  .join('|');

const AIRCRAFT_RE = /^(319|320|321|330|340|350|380|737|738|747|757|767|777|787|E\d{2,3})$/i;

function parseHoursMinutes(val: string): number {
  const parts = val.split(/[.:]/);
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return Math.round((h + m / 60) * 100) / 100;
}

export function parseRosterDateToken(raw: string): string | null {
  const m = raw.match(/(\d{1,2})[\s-]([A-Za-z]{3})[\s-](\d{2,4})/i);
  if (!m) return null;
  const day = m[1].padStart(2, '0');
  const monthKey = m[2].toUpperCase();
  const month = MONTH_MAP[monthKey];
  if (!month) return null;
  let year = m[3];
  if (year.length === 2) year = `20${year}`;
  return `${year}-${month}-${day}`;
}

/** Junta quebras, colapsa espaços, padroniza DD-MMM-YYYY com mês em maiúsculas (ex.: 03-Mar-2026 → 03-MAR-2026). */
export function normalizeCrewRosterPdfText(text: string): string {
  let s = text
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2000-\u200B\uFEFF]/g, ' ')
    .replace(/\r\n?/g, ' ')
    .replace(/[\t\f\v]+/g, ' ');
  s = s.replace(/[\u2010-\u2015\u2212]/g, '-');
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/\b(\d{1,2})-([A-Za-z]{3})-(\d{4})\b/g, (_, d: string, mon: string, y: string) => {
    return `${d}-${mon.toUpperCase()}-${y}`;
  });
  return s.trim();
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function dedupe(entries: CrewRosterParsedEntry[]): CrewRosterParsedEntry[] {
  const seen = new Set<string>();
  return entries.filter((e) => {
    const key = `${e.date}|${e.entryType}|${e.activityType}|${e.flightNumber}|${e.departureAirport}|${e.departureTime}|${e.arrivalAirport}|${e.arrivalTime}|${e.crewStatusCode}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Extrai voos e atividades do texto já normalizado.
 */
export function parseCrewRosterEntries(normalized: string): {
  entries: CrewRosterParsedEntry[];
  stats: CrewRosterParseStats;
  textByDay: Record<string, string>;
  devUnrecognizedLines: string[];
} {
  const dateRegex = /\b(\d{1,2}-[A-Z]{3}-\d{4})\b/g;
  const datePositions: { date: string; pos: number }[] = [];
  let dm: RegExpExecArray | null;
  while ((dm = dateRegex.exec(normalized)) !== null) {
    const parsed = parseRosterDateToken(dm[1]);
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

  /** Quando o PDF vem fora de ordem, a data pode estar antes ou depois do token no stream. */
  function resolveDateForAnchor(pos: number): string {
    const fromAnchors = getDateForPosition(pos);
    if (fromAnchors) return fromAnchors;
    const lookback = normalized.substring(Math.max(0, pos - 320), pos);
    const dateMatches = [...lookback.matchAll(/\b(\d{1,2}-[A-Z]{3}-\d{4})\b/g)];
    for (let i = dateMatches.length - 1; i >= 0; i--) {
      const iso = parseRosterDateToken(dateMatches[i][1]);
      if (iso) return iso;
    }
    const lookahead = normalized.substring(pos, Math.min(pos + 160, normalized.length));
    const ahead = lookahead.match(/\b(\d{1,2}-[A-Z]{3}-\d{4})\b/);
    if (ahead) {
      const iso = parseRosterDateToken(ahead[1]);
      if (iso) return iso;
    }
    return '';
  }

  const textByDay: Record<string, string> = {};
  for (let i = 0; i < datePositions.length; i++) {
    const start = datePositions[i].pos;
    const end = i + 1 < datePositions.length ? datePositions[i + 1].pos : normalized.length;
    const segment = normalized.substring(start, end).trim();
    const date = datePositions[i].date;
    textByDay[date] = textByDay[date] ? `${textByDay[date]} | ${segment}` : segment;
  }

  const entries: CrewRosterParsedEntry[] = [];
  let totalRawAnchors = 0;
  const devUnrecognizedLines: string[] = [];

  // Voos: horário opcional de report + LA/JJ + função + OP|PS + rota (horários H:MM ou HH:MM)
  const flightRe = new RegExp(
    `(?:\\b(\\d{1,2}:\\d{2})\\s+)?((?:LA|JJ)\\s*\\d{3,5})\\s+(${CREW_ROLES})\\s+(OP|PS)\\s+([A-Z]{3})\\s+(\\d{1,2}:\\d{2})\\s+([A-Z]{3})\\s+(\\d{1,2}:\\d{2})(?:\\s*\\(\\+1\\))?`,
    'gi',
  );

  let fm: RegExpExecArray | null;
  while ((fm = flightRe.exec(normalized)) !== null) {
    totalRawAnchors++;
    const matchPos = fm.index;
    const matchEnd = matchPos + fm[0].length;
    const date = resolveDateForAnchor(matchPos);
    if (!date) continue;

    const reportFromPattern = fm[1] ? padHHmm(fm[1]) : '';
    const flightNumber = fm[2]
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/^JJ/, 'LA');
    const crewRole = fm[3].toUpperCase();
    const op = fm[4].toUpperCase();
    const depAirport = fm[5].toUpperCase();
    const depTime = padHHmm(fm[6]);
    const arrAirport = fm[7].toUpperCase();
    const arrTime = padHHmm(fm[8]);

    const beforeFlight = normalized.substring(Math.max(0, matchPos - 14), matchPos);
    const reportAlt = beforeFlight.match(/(\d{1,2}:\d{2})\s+$/);
    const reportTime = reportFromPattern || (reportAlt ? padHHmm(reportAlt[1]) : '');

    const { code: crewStatusCode, label: crewStatusLabel } = resolveCrewStatusFromFlightOperation(op);

    let crossesMidnight = didCrossMidnight(depTime, arrTime);
    const after = normalized.substring(matchEnd, Math.min(matchEnd + 40, normalized.length)).trim();
    if (after.startsWith('(+1)')) crossesMidnight = true;

    const sortDatetime = `${date}T${depTime}:00`;

    entries.push({
      date,
      activityType: 'flight',
      isFlight: true,
      flightNumber,
      pairingCode: '',
      crewRole,
      operationType: op,
      reportTime,
      departureAirport: depAirport,
      departureTime: depTime,
      arrivalAirport: arrAirport,
      arrivalTime: arrTime,
      debriefTime: '',
      flightHours: null,
      dutyHours: null,
      aircraftType: '',
      hotelName: '',
      assignment: '',
      comments: '',
      rawLine: normalized.substring(matchPos, Math.min(matchPos + 140, normalized.length)),
      crossesMidnight,
      overnight: crossesMidnight,
      sortDatetime,
      entryType: 'flight',
      crewStatusCode,
      crewStatusLabel,
      activityLabel: '',
    });
  }

  // Apresentação com trecho: APR CC CGH 22:00 CGH 00:02 (+1)
  const aprRe = new RegExp(
    `APR\\s+(${CREW_ROLES})\\s+([A-Z]{3})\\s+(\\d{1,2}:\\d{2})\\s+([A-Z]{3})\\s+(\\d{1,2}:\\d{2})(?:\\s*\\(\\+1\\))?`,
    'gi',
  );
  let am: RegExpExecArray | null;
  while ((am = aprRe.exec(normalized)) !== null) {
    totalRawAnchors++;
    const pos = am.index;
    const date = resolveDateForAnchor(pos);
    if (!date) continue;
    const crewRole = am[1].toUpperCase();
    const dep = am[2].toUpperCase();
    const t1 = padHHmm(am[3]);
    const arr = am[4].toUpperCase();
    const t2 = padHHmm(am[5]);
    let crosses = didCrossMidnight(t1, t2);
    const tail = normalized.substring(am.index + am[0].length, am.index + am[0].length + 6);
    if (tail.includes('(+1)')) crosses = true;
    const st = resolveCrewStatusFromActivityCode('APR');
    entries.push({
      date,
      activityType: 'APR',
      isFlight: false,
      flightNumber: 'APR',
      pairingCode: '',
      crewRole,
      operationType: '',
      reportTime: t1,
      departureAirport: dep,
      departureTime: t1,
      arrivalAirport: arr,
      arrivalTime: t2,
      debriefTime: '',
      flightHours: null,
      dutyHours: null,
      aircraftType: '',
      hotelName: '',
      assignment: '',
      comments: '',
      rawLine: normalized.substring(pos, Math.min(pos + 120, normalized.length)),
      crossesMidnight: crosses,
      overnight: crosses,
      sortDatetime: `${date}T${t1}:00`,
      entryType: st.entryType,
      crewStatusCode: st.code,
      crewStatusLabel: st.label,
      activityLabel: 'Apresentação',
    });
  }

  // Atividades somente código: 02-MAR-2026 DO ou ... HSB ...
  const soloAct = new RegExp(
    `\\b(\\d{1,2}-[A-Z]{3}-\\d{4})\\s+(?:${NON_FLIGHT_TOKEN}|Standby|STANDBY|STBY)\\b`,
    'gi',
  );
  let sm: RegExpExecArray | null;
  while ((sm = soloAct.exec(normalized)) !== null) {
    const dateStr = sm[1];
    const parsedDate = parseRosterDateToken(dateStr);
    if (!parsedDate) continue;
    const rest = normalized.substring(sm.index + sm[1].length).trim();
    const codeMatch = rest.match(
      new RegExp(`^(${NON_FLIGHT_TOKEN}|Standby|STANDBY|STBY)\\b`, 'i'),
    );
    if (!codeMatch) continue;
    let codeRaw = codeMatch[1];
    if (/^standby|stby$/i.test(codeRaw)) codeRaw = 'STANDBY';
    const code = codeRaw.toUpperCase();
    const pos = sm.index;
    const charBefore = pos > 0 ? normalized[pos - 1] : ' ';
    if (charBefore === '/' || charBefore === '-') continue;

    totalRawAnchors++;
    const st = resolveCrewStatusFromActivityCode(code === 'STANDBY' ? 'STANDBY' : code);
    entries.push({
      date: parsedDate,
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
      sortDatetime: `${parsedDate}T00:00:00`,
      entryType: st.entryType,
      crewStatusCode: st.code,
      crewStatusLabel: st.label,
      activityLabel: st.label,
    });
  }

  // Códigos soltos (DO, HSB, …) já capturados; segunda passagem genérica para tokens perdidos
  const nfRegex = new RegExp(`\\b(${NON_FLIGHT_TOKEN})\\b(?![\\/\\-])`, 'gi');
  let nfm: RegExpExecArray | null;
  while ((nfm = nfRegex.exec(normalized)) !== null) {
    const code = nfm[1].toUpperCase();
    if (code === 'APR') continue; // já coberto pelo padrão APR CC … (evita duplicar com o mesmo token)
    const pos = nfm.index;
    const charBefore = pos > 0 ? normalized[pos - 1] : ' ';
    if (charBefore === '/' || charBefore === '-') continue;
    const charAfter = normalized[pos + code.length] ?? ' ';
    if (charAfter === '-') continue;
    const before40 = normalized.substring(Math.max(0, pos - 40), pos).toLowerCase();
    if (before40.includes('assignment') || before40.includes('hotel')) continue;

    const date = resolveDateForAnchor(pos);
    if (!date) continue;

    // Evitar duplicar DO já pego
    const dup = entries.some(
      (e) =>
        e.date === date &&
        !e.isFlight &&
        e.flightNumber === code &&
        e.departureAirport === '',
    );
    if (dup) continue;

    totalRawAnchors++;
    const st = resolveCrewStatusFromActivityCode(code);
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
      entryType: st.entryType,
      crewStatusCode: st.code,
      crewStatusLabel: st.label,
      activityLabel: st.label,
    });
  }

  const deduped = dedupe(entries);

  // Diagnóstico: linhas com data mas sem LA na fatia (apenas dev)
  if (import.meta.env.DEV && deduped.length === 0 && datePositions.length > 0) {
    const sample = normalized.substring(0, Math.min(600, normalized.length));
    devUnrecognizedLines.push(`[crew-roster-parser] Nenhuma entrada; amostra: ${sample}`);
  }

  const stats: CrewRosterParseStats = {
    totalEntries: deduped.length,
    totalRawAnchors,
    totalFlights: deduped.filter((e) => e.isFlight).length,
    totalDO: deduped.filter((e) => e.entryType === 'day_off').length,
    totalStandby: deduped.filter((e) => e.entryType === 'standby').length,
    totalAPR: deduped.filter((e) => e.activityType === 'APR' || e.crewStatusCode === 'APR').length,
    totalReserve: deduped.filter((e) => e.entryType === 'reserve').length,
    totalOnCall: deduped.filter((e) => e.entryType === 'on_call').length,
    totalPresentation: deduped.filter((e) => e.entryType === 'duty_start').length,
    totalAfterDedup: deduped.length,
    unrecognizedSnippetCount: devUnrecognizedLines.length,
  };

  return { entries: deduped, stats, textByDay, devUnrecognizedLines };
}

function didCrossMidnight(dep: string, arr: string): boolean {
  const d = timeToMinutes(dep);
  const a = timeToMinutes(arr);
  return d >= 0 && a >= 0 && a < d;
}

function padHHmm(t: string): string {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return t;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}
