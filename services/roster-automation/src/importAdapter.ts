/**
 * Reutiliza o pipeline de importação PDF do monorepo com service role (sem Edge Function).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { importPdfArrayBufferWithClient } from '../../../src/lib/pdf-import.ts';
import { log } from './logger.js';

export async function importDownloadedPdf(params: {
  supabase: SupabaseClient;
  userId: string;
  fileName: string;
  pdfBytes: ArrayBuffer;
  automationRunId: string;
}): Promise<{ success: boolean; rosterId: string | null; error: string | null }> {
  const { supabase, userId, fileName, pdfBytes, automationRunId } = params;
  log('importAdapter', 'info', 'import_start', { userId, fileName, bytes: pdfBytes.byteLength });
  try {
    const result = await importPdfArrayBufferWithClient({
      supabaseClient: supabase,
      fileName,
      arrayBuffer: pdfBytes,
      userId,
      useSessionUser: false,
      emitRosterEvent: false,
      importOrigin: 'latam_automation',
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
