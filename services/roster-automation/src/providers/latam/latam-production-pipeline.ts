/**
 * Produção LATAM: Rota de Ouro GET autenticado (RosterReport HTML → PDF) + fallback UI eCrew;
 * opcional fallback legado SAB → iFlight (`LATAM_ROSTER_FALLBACK_IFLIGHT=1`).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { BrowserContext, Page } from 'playwright';
import { config } from '../../config.js';
import { getServiceClient } from '../../db.js';
import { importLatamEcrewCaptureFiles, importDownloadedPdf } from '../../importAdapter.js';
import { ensurePortalSabSurface } from './portal-sab-navigation.js';
import { runSabToCrewRosterPdf } from './sab-iflight-pipeline.js';
import type { CorporateFsmState } from './fsm-types.js';
import type { PostLoginNavigationInstrument } from './post-login-navigation-instrumentation.js';
import type { NavigationDebugPayload } from './post-login-navigation-instrumentation.js';
import { runEcrewRosterCaptureSequence } from './ecrew-roster-flow.js';

export type LatamPipelineLog = (entry: Record<string, unknown>) => Promise<void>;

async function importPdfBuffer(params: {
  userId: string;
  runId: string;
  fileName: string;
  buffer: Buffer;
}): Promise<{ rosterId: string }> {
  const { userId, runId, fileName, buffer } = params;
  const supabase = getServiceClient();
  const pdfBuf = new Uint8Array(buffer).buffer as ArrayBuffer;
  const imp = await importDownloadedPdf({
    supabase,
    userId,
    fileName,
    pdfBytes: pdfBuf,
    automationRunId: runId,
    importOrigin: 'latam_automation',
  });
  if (!imp.success || !imp.rosterId) {
    throw new Error(imp.error ?? 'Falha na importação do PDF');
  }
  return { rosterId: imp.rosterId };
}

/**
 * Captura escala (eCrew) e importa para o EscalaX. Lança erro se não houver artefatos nem fallback.
 */
export async function runLatamGoldPathRosterImport(params: {
  context: BrowserContext;
  page: Page;
  userId: string;
  runId: string;
  sessionUserDir: string;
  appendLog: LatamPipelineLog;
  onFsmPhase?: (phase: CorporateFsmState) => void | Promise<void>;
  instrument?: PostLoginNavigationInstrument;
  persistNavigationDebug?: (payload: NavigationDebugPayload) => Promise<void>;
}): Promise<{ rosterId: string; mode: 'ecrew' | 'sab_iflight' }> {
  const { context, page, userId, runId, sessionUserDir, appendLog, onFsmPhase, instrument, persistNavigationDebug } = params;

  const captureDir = path.join(sessionUserDir, 'captures');
  await fs.mkdir(captureDir, { recursive: true });

  await onFsmPhase?.('locating_roster');
  await appendLog({ step: 'latam_pipeline', phase: 'ecrew_gold_path_start' });

  const probe = await runEcrewRosterCaptureSequence(page, context, captureDir, {
    ecredEntryUrl: config.latamEcredEntryUrl() || undefined,
    appendLog,
  });

  await onFsmPhase?.('downloading_report');

  if (probe.pdfSavedPath || probe.htmlSavedPath) {
    await appendLog({
      step: 'ecrew_artifacts',
      pdfPath: probe.pdfSavedPath,
      htmlPath: probe.htmlSavedPath,
      ecrewBase: probe.ecrewBaseUrl,
    });
    await onFsmPhase?.('importing_report');
    const supabase = getServiceClient();
    const { rosterId } = await importLatamEcrewCaptureFiles({
      supabase,
      userId,
      automationRunId: runId,
      pdfPath: probe.pdfSavedPath,
      htmlPath: probe.htmlSavedPath,
    });
    await appendLog({ step: 'ecrew_import_ok', rosterId });
    return { rosterId, mode: 'ecrew' };
  }

  if (config.latamRosterFallbackIflight()) {
    await appendLog({
      step: 'ecrew_fallback_sab_iflight',
      message: 'Sem PDF/HTML eCrew — fallback SAB/iFlight',
      lastError: probe.lastError,
    });
    const sabUrl = config.latamPortalSabUrl();
    await ensurePortalSabSurface(page, sabUrl, appendLog);
    const { buffer, fileName } = await runSabToCrewRosterPdf({
      context,
      page,
      userId,
      runId,
      failDir: path.join(sessionUserDir, 'failures'),
      appendLog,
      onFsmPhase,
      instrument,
      persistNavigationDebug,
    });
    const { rosterId } = await importPdfBuffer({ userId, runId, fileName, buffer });
    return { rosterId, mode: 'sab_iflight' };
  }

  throw new Error(
    probe.lastError ??
      'eCrew não devolveu RosterReport (HTML/PDF). Configure LATAM_ECREW_ENTRY_URL ou use LATAM_ROSTER_FALLBACK_IFLIGHT=1.',
  );
}
