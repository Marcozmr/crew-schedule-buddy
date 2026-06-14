import {
  normalizeCrewRosterPdfText,
  parseCrewRosterEntries,
} from '@/lib/roster/crew-roster-parser';
import { parseHeader, mapParsedToRosterEntry } from '@/lib/pdf-import';
import type { AirlineConnector, NormalizedRoster } from '../autoImportTypes';

/**
 * URL de login do portal corporativo LATAM.
 * Configurada via VITE_CORPORATE_PORTAL_LOGIN_URL no .env — nunca hardcoded.
 * Para iFlight Neo/iFlight Crew, usar VITE_LATAM_IFLIGHT_LOGIN_URL.
 */
export const LATAM_IFLIGHT_LOGIN_URL: string =
  (import.meta.env.VITE_LATAM_IFLIGHT_LOGIN_URL as string | undefined)?.trim() ||
  (import.meta.env.VITE_CORPORATE_PORTAL_LOGIN_URL as string | undefined)?.trim() ||
  '';

/**
 * Palavras-chave que identificam a página de escala no portal LATAM.
 */
export const LATAM_IFLIGHT_ROSTER_KEYWORDS: string[] = [
  'CrewRoster',
  'Crew Roster',
  'iFlight',
  'roster',
  'escala',
  'LATAM Crew',
  'CrewRosterReport',
];

const LATAM_LOGIN_SUCCESS_PATTERNS = [
  /iflight/i,
  /crew\.latam/i,
  /mylatam/i,
  /portal\.latam/i,
  /dashboard/i,
  /home/i,
];

const LATAM_ROSTER_PAGE_PATTERNS = [
  /roster/i,
  /escala/i,
  /crew.?roster/i,
  /monthly/i,
  /myschedule/i,
];

export const latamConnector: AirlineConnector = {
  airline: 'LATAM',
  loginUrl: LATAM_IFLIGHT_LOGIN_URL,

  detectLoginSuccess(url: string, html?: string): boolean {
    const combined = `${url} ${html ?? ''}`;
    return (
      LATAM_LOGIN_SUCCESS_PATTERNS.some((p) => p.test(url)) ||
      LATAM_IFLIGHT_ROSTER_KEYWORDS.some((kw) => combined.includes(kw))
    );
  },

  detectRosterPage(url: string, html?: string): boolean {
    const combined = `${url} ${html ?? ''}`;
    return LATAM_ROSTER_PAGE_PATTERNS.some((p) => p.test(combined));
  },

  async extractRoster(input): Promise<NormalizedRoster> {
    const { html, text, pdfFile, pdfArrayBuffer } = input;

    // Prioridade 1: PDF oficial da página
    if (pdfArrayBuffer || pdfFile) {
      const buffer = pdfArrayBuffer ?? (await pdfFile!.arrayBuffer());
      const { extractTextFromPdfBuffer } = await import('@/lib/pdf-import');
      const rawText = await extractTextFromPdfBuffer(buffer);
      return buildRosterFromText(rawText);
    }

    // Prioridade 2: HTML da página de escala
    if (html?.trim()) {
      const rawText = stripHtmlTags(html);
      return buildRosterFromText(rawText);
    }

    // Prioridade 3: Texto visível extraído
    if (text?.trim()) {
      return buildRosterFromText(text);
    }

    return emptyRoster();
  },
};

function buildRosterFromText(rawText: string): NormalizedRoster {
  const normalized = normalizeCrewRosterPdfText(rawText);
  const { entries: parsed } = parseCrewRosterEntries(normalized);
  const entries = parsed.map(mapParsedToRosterEntry);
  const header = parseHeader(rawText);

  return {
    header,
    entries,
    rawText,
    sourceAirline: 'LATAM',
    importedAt: new Date().toISOString(),
  };
}

function emptyRoster(): NormalizedRoster {
  return {
    header: null,
    entries: [],
    rawText: '',
    sourceAirline: 'LATAM',
    importedAt: new Date().toISOString(),
  };
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
