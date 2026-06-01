/**
 * Reutiliza o pipeline de importação PDF/HTML do monorepo com service role (sem Edge Function).
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import type { SupabaseClient } from '@supabase/supabase-js';
import { importPdfArrayBufferWithClient } from '../../../src/lib/pdf-import.ts';
import { log } from './logger.js';

export type CorporateAutomationImportOrigin = 'latam_automation' | 'gol_automation' | 'azul_automation';

function htmlReportToPlainText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|table)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export async function importDownloadedPdf(params: {
  supabase: SupabaseClient;
  userId: string;
  fileName: string;
  pdfBytes: ArrayBuffer;
  automationRunId: string;
  importOrigin?: CorporateAutomationImportOrigin;
}): Promise<{ success: boolean; rosterId: string | null; error: string | null }> {
  const { supabase, userId, fileName, pdfBytes, automationRunId } = params;
  const importOrigin = params.importOrigin ?? 'latam_automation';
  log('importAdapter', 'info', 'import_start', { userId, fileName, bytes: pdfBytes.byteLength, importOrigin });
  try {
    const result = await importPdfArrayBufferWithClient({
      supabaseClient: supabase,
      fileName,
      arrayBuffer: pdfBytes,
      userId,
      useSessionUser: false,
      emitRosterEvent: false,
      importOrigin,
      automationRunId,
    });
    if (!result.success) {
      return { success: false, rosterId: null, error: result.error ?? 'Importação falhou' };
    }
    return { success: true, rosterId: result.rosterId, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log('importAdapter', 'error', 'import_exception', { message: msg });
    return { success: false, rosterId: null, error: msg };
  }
}

/**
 * Importa relatório HTML Crew Roster (texto extraído → mesmo parser LATAM que o PDF).
 */
export async function importLatamHtmlReportBuffer(params: {
  supabase: SupabaseClient;
  userId: string;
  fileName: string;
  htmlUtf8: Buffer;
  automationRunId: string;
  /** Parser Crew Roster LATAM; outras companhias gravam a mesma origem de automação. */
  importOrigin?: CorporateAutomationImportOrigin;
}): Promise<{ success: boolean; rosterId: string | null; error: string | null }> {
  const importOrigin = params.importOrigin ?? 'latam_automation';
  const text = htmlReportToPlainText(params.htmlUtf8.toString('utf8'));
  const ab = params.htmlUtf8.buffer.slice(
    params.htmlUtf8.byteOffset,
    params.htmlUtf8.byteOffset + params.htmlUtf8.byteLength,
  ) as ArrayBuffer;
  log('importAdapter', 'info', 'import_html_start', {
    userId: params.userId,
    fileName: params.fileName,
    textLen: text.length,
    importOrigin,
  });
  try {
    const result = await importPdfArrayBufferWithClient({
      supabaseClient: params.supabase,
      fileName: /\.html?$/i.test(params.fileName) ? params.fileName : `${params.fileName}.html`,
      arrayBuffer: ab,
      extractedTextOverride: text,
      userId: params.userId,
      useSessionUser: false,
      emitRosterEvent: false,
      importOrigin,
      automationRunId: params.automationRunId,
    });
    if (!result.success) {
      return { success: false, rosterId: null, error: result.error ?? 'Importação HTML falhou' };
    }
    return { success: true, rosterId: result.rosterId, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log('importAdapter', 'error', 'import_html_exception', { message: msg });
    return { success: false, rosterId: null, error: msg };
  }
}

/**
 * Prioridade: PDF → HTML (parser LATAM). Usado após `runEcrewRosterCaptureSequence`.
 */
export async function importLatamEcrewCaptureFiles(params: {
  supabase: SupabaseClient;
  userId: string;
  automationRunId: string;
  pdfPath: string | null;
  htmlPath: string | null;
}): Promise<{ rosterId: string; used: 'pdf' | 'html' }> {
  const { supabase, userId, automationRunId } = params;
  if (params.pdfPath) {
    const buf = await fs.readFile(params.pdfPath);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    const r = await importDownloadedPdf({
      supabase,
      userId,
      fileName: path.basename(params.pdfPath),
      pdfBytes: ab,
      automationRunId,
      importOrigin: 'latam_automation',
    });
    if (!r.success || !r.rosterId) {
      throw new Error(r.error ?? 'Falha ao importar PDF eCrew');
    }
    return { rosterId: r.rosterId, used: 'pdf' };
  }
  if (params.htmlPath) {
    const htmlUtf8 = await fs.readFile(params.htmlPath);
    const r = await importLatamHtmlReportBuffer({
      supabase,
      userId,
      fileName: path.basename(params.htmlPath),
      htmlUtf8,
      automationRunId,
    });
    if (!r.success || !r.rosterId) {
      throw new Error(r.error ?? 'Falha ao importar HTML eCrew');
    }
    return { rosterId: r.rosterId, used: 'html' };
  }
  throw new Error('Sem ficheiros RosterReport (PDF/HTML) para importar');
}
