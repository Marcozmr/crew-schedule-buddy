export interface RosterFlight {
  flightNumber: string;
  date: string | null;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  crew: string[];
  rawLine: string;
  role?: string | null;
  serviceStatus?: string | null; // OP / PS
  aircraftType?: string | null;
}

export interface RosterDayOff {
  date: string | null;
  label: string;
  rawLine: string;
}

export interface RosterReserve {
  date: string | null;
  label: string;
  startTime?: string | null;
  endTime?: string | null;
  rawLine: string;
}

export interface RosterApr {
  date: string | null;
  location: string | null;
  time: string | null;
  rawLine: string;
}

export interface RosterParseResult {
  flights: RosterFlight[];
  daysOff: RosterDayOff[];
  reserves: RosterReserve[];
  aprs: RosterApr[];
  normalizedText: string;
  warnings: string[];
}

export interface RosterParserInput {
  htmlContent?: string | null;
  pdfText?: string | null;
}

export function parseRosterToJson(input: RosterParserInput): RosterParseResult {
  const sourceText = pickBestSourceText(input);
  const normalizedText = normalizeRosterText(sourceText);
  const logicalLines = buildLogicalLines(normalizedText);

  const flights: RosterFlight[] = [];
  const daysOff: RosterDayOff[] = [];
  const reserves: RosterReserve[] = [];
  const aprs: RosterApr[] = [];
  const warnings: string[] = [];

  for (const line of logicalLines) {
    const cleaned = cleanLineNoise(line);
    if (!cleaned) continue;

    const dayOff = matchDayOffLine(cleaned);
    if (dayOff) {
      daysOff.push(dayOff);
      continue;
    }

    const reserve = matchReserveLine(cleaned);
    if (reserve) {
      reserves.push(reserve);
      continue;
    }

    const apr = matchAprLine(cleaned);
    if (apr) {
      aprs.push(apr);
      continue;
    }

    const flight = matchRosterFlightLine(cleaned);
    if (flight) {
      flights.push(flight);
      continue;
    }
  }

  if (flights.length === 0) {
    warnings.push('Nenhum voo reconhecido pelo parser.');
  }

  return {
    flights,
    daysOff,
    reserves,
    aprs,
    normalizedText,
    warnings,
  };
}

function pickBestSourceText({ htmlContent, pdfText }: RosterParserInput): string {
  if (htmlContent && htmlContent.trim()) {
    return htmlToPlainText(htmlContent);
  }
  if (pdfText && pdfText.trim()) {
    return pdfText;
  }
  return '';
}

function htmlToPlainText(html: string): string {
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/div>/gi, '\n');

  text = text.replace(/<[^>]+>/g, ' ');
  return text;
}

function normalizeRosterText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/**
 * Junta linhas quebradas do PDF em "linhas lógicas".
 * Cada nova linha lógica começa quando aparece uma data DD-MMM-YYYY.
 */
function buildLogicalLines(text: string): string[] {
  const rawLines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const result: string[] = [];
  let buffer = '';

  for (const line of rawLines) {
    if (isHeaderOrGarbage(line)) continue;

    if (startsWithRosterDate(line)) {
      if (buffer) result.push(buffer.trim());
      buffer = line;
    } else {
      if (!buffer) {
        buffer = line;
      } else {
        buffer += ' ' + line;
      }
    }
  }

  if (buffer) result.push(buffer.trim());

  return result;
}

function isHeaderOrGarbage(line: string): boolean {
  if (!line) return true;

  return [
    /^Roster Report\b/i,
    /^Date Pairing\/Activity\b/i,
    /^\(\+1\)$/i,
    /^20-P$/i,
    /^[A-Z0-9]{4,}-P$/i,
  ].some((rx) => rx.test(line));
}

function startsWithRosterDate(line: string): boolean {
  return /^\d{2}-[A-Za-z]{3}-\d{4}\b/.test(line);
}

function cleanLineNoise(line: string): string {
  return line
    .replace(/\(\+1\)/g, '')
    .replace(/\b\d{2}-P\b/g, '')
    .replace(/\b[A-Z]{4}\d{0,3}-\d{2}\/\d{6}\/[A-Z0-9]+\b/g, '')
    .replace(/\bLA\d{3,4}\/\d{6}\/[A-Z0-9]+\b/g, (m) => {
      const match = m.match(/\b(LA\d{3,4})\//i);
      return match ? match[1].toUpperCase() : m;
    })
    .replace(/\bLA\d{3,4}-\d{2}\/\d{6}\/[A-Z0-9]+\b/g, (m) => {
      const match = m.match(/\b(LA\d{3,4})-/i);
      return match ? match[1].toUpperCase() : m;
    })
    .replace(/\bASB-\d{2}\/\d{6}\/[A-Z0-9]+\b/gi, 'ASB')
    .replace(/\bHSBE?-\d{2}\/\d{6}\/[A-Z0-9]+\b/gi, 'HSBE')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchDayOffLine(line: string): RosterDayOff | null {
  const m = line.match(
    /^(?<date>\d{2}-[A-Za-z]{3}-\d{4})\s+(?<label>DO|OFF|REST)\b/i,
  );
  if (!m?.groups) return null;

  return {
    date: normalizeRosterDate(m.groups.date),
    label: m.groups.label.toUpperCase(),
    rawLine: line,
  };
}

function matchReserveLine(line: string): RosterReserve | null {
  const m = line.match(
    /^(?<date>\d{2}-[A-Za-z]{3}-\d{4})\s+(?<label>HSB|HSBE|ASB)\b.*?(?<start>\d{2}:\d{2}).*?(?<end>\d{2}:\d{2})?$/i,
  );
  if (!m?.groups) return null;

  return {
    date: normalizeRosterDate(m.groups.date),
    label: m.groups.label.toUpperCase(),
    startTime: m.groups.start ? normalizeTime(m.groups.start) : null,
    endTime: m.groups.end ? normalizeTime(m.groups.end) : null,
    rawLine: line,
  };
}

function matchAprLine(line: string): RosterApr | null {
  const m = line.match(
    /^(?<date>\d{2}-[A-Za-z]{3}-\d{4})\s+APR\b.*?\b(?<loc>[A-Z]{3})\b\s+(?<time>\d{2}:\d{2})\b/i,
  );
  if (!m?.groups) return null;

  return {
    date: normalizeRosterDate(m.groups.date),
    location: m.groups.loc?.toUpperCase() ?? null,
    time: m.groups.time ? normalizeTime(m.groups.time) : null,
    rawLine: line,
  };
}

function matchRosterFlightLine(line: string): RosterFlight | null {
  const m = line.match(
    /^(?<date>\d{2}-[A-Za-z]{3}-\d{4})\s+(?:(?<report>\d{2}:\d{2})\s+)?(?<flt>(?:LA|JJ|G3|AD)\d{3,4})\b(?:\s+(?<role>[A-Z]{2}))?(?:\s+(?<status>OP|PS))?\s+(?<org>[A-Z]{3})\s+(?<dep>\d{2}:\d{2})\s+(?<dst>[A-Z]{3})\s+(?<arr>\d{2}:\d{2})(?:\s+(?<extra>.*))?$/i,
  );

  if (!m?.groups) return null;

  const extra = (m.groups.extra || '').trim();
  const aircraftTypeMatch = extra.match(/\b(319|320|321|32S|31R|328)\b/i);

  return {
    flightNumber: m.groups.flt.toUpperCase(),
    date: normalizeRosterDate(m.groups.date),
    origin: m.groups.org.toUpperCase(),
    destination: m.groups.dst.toUpperCase(),
    departureTime: normalizeTime(m.groups.dep),
    arrivalTime: normalizeTime(m.groups.arr),
    crew: [],
    rawLine: line,
    role: m.groups.role?.toUpperCase() ?? null,
    serviceStatus: m.groups.status?.toUpperCase() ?? null,
    aircraftType: aircraftTypeMatch ? aircraftTypeMatch[1].toUpperCase() : null,
  };
}

function normalizeTime(token: string): string {
  const t = token.replace('h', ':');
  const [hh, mm] = t.split(':');
  const h = Math.max(0, Math.min(23, parseInt(hh || '0', 10)));
  const m = Math.max(0, Math.min(59, parseInt(mm || '0', 10)));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function normalizeRosterDate(dateStr: string): string {
  const m = dateStr.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return dateStr;

  const [, dd, mon, yyyy] = m;
  const monthMap: Record<string, string> = {
    Jan: '01',
    Feb: '02',
    Mar: '03',
    Apr: '04',
    May: '05',
    Jun: '06',
    Jul: '07',
    Aug: '08',
    Sep: '09',
    Oct: '10',
    Nov: '11',
    Dec: '12',
  };

  const mm = monthMap[capitalize(mon)] || '01';
  return `${yyyy}-${mm}-${dd}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}