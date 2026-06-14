import {
  normalizeCrewRosterPdfText,
  parseCrewRosterEntries,
} from '@/lib/roster/crew-roster-parser';
import { parseHeader, mapParsedToRosterEntry } from '@/lib/pdf-import';
import type { AirlineConnector, NormalizedRoster } from '../autoImportTypes';

/**
 * Conector genérico para importação via PDF.
 * Reutiliza o mesmo parser do fluxo manual (pdf-import.ts + crew-roster-parser.ts).
 * Usado como fallback para qualquer companhia sem conector dedicado.
 */
export const genericPdfConnector: AirlineConnector = {
  airline: 'GENERIC',
  loginUrl: '',

  detectLoginSuccess(_url: string, _html?: string): boolean {
    return false;
  },

  detectRosterPage(_url: string, _html?: string): boolean {
    return false;
  },

  async extractRoster(input): Promise<NormalizedRoster> {
    const { pdfFile, pdfArrayBuffer, text, html } = input;

    if (pdfArrayBuffer || pdfFile) {
      const buffer = pdfArrayBuffer ?? (await pdfFile!.arrayBuffer());
      const { extractTextFromPdfBuffer } = await import('@/lib/pdf-import');
      const rawText = await extractTextFromPdfBuffer(buffer);
      return buildFromText(rawText);
    }

    if (text?.trim()) return buildFromText(text);
    if (html?.trim()) return buildFromText(stripHtmlTags(html));

    return {
      header: null,
      entries: [],
      rawText: '',
      sourceAirline: 'GENERIC',
      importedAt: new Date().toISOString(),
    };
  },
};

function buildFromText(rawText: string): NormalizedRoster {
  const normalized = normalizeCrewRosterPdfText(rawText);
  const { entries: parsed } = parseCrewRosterEntries(normalized);
  const entries = parsed.map(mapParsedToRosterEntry);
  const header = parseHeader(rawText);

  return {
    header,
    entries,
    rawText,
    sourceAirline: 'GENERIC',
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
