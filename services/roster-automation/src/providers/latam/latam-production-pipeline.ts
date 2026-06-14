/**
 * Produção LATAM: pipeline SAB → iFlight Neo → CrewRosterReport (PDF).
 * eCrew (Rota de Ouro) é tentado apenas se `LATAM_ECREW_ENTRY_URL` estiver definida
 * ou se o browser já estiver em /ecrew/. Caso contrário, o fluxo vai diretamente ao SAB.
 * O fallback SAB → iFlight pode ser desativado via `LATAM_ROSTER_FALLBACK_IFLIGHT=0`.
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
  // Duplicata é sucesso legítimo — mesma escala já importada anteriormente
  if (imp.insertedCount === 0 && !imp.duplicate) {
    throw new Error('Login realizado, mas nenhuma escala foi importada.');
  }
  return { rosterId: imp.rosterId };
}

/**
 * Captura escala e importa para o EscalaX.
 * Rota: SAB → iFlight Neo (padrão). eCrew é tentado apenas se `LATAM_ECREW_ENTRY_URL` estiver definida.
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

  // ── eCrew (opcional) ─────────────────────────────────────────────────────────
  const ecrewEntryUrl = config.latamEcredEntryUrl() || undefined;
  const alreadyOnEcrew = /\/ecrew\//i.test(page.url());

  if (ecrewEntryUrl || alreadyOnEcrew) {
    await appendLog({
      step: 'ecrew_attempt',
      reason: ecrewEntryUrl ? 'LATAM_ECREW_ENTRY_URL definida' : 'browser já em /ecrew/',
      entryUrl: ecrewEntryUrl ?? 'auto_discover',
    });
    await onFsmPhase?.('locating_roster');

    const probe = await runEcrewRosterCaptureSequence(page, context, captureDir, {
      ecredEntryUrl: ecrewEntryUrl,
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

    await appendLog({
      step: 'ecrew_failed',
      lastError: probe.lastError,
      hint: 'Sem artefatos — passando para SAB → iFlight Neo',
    });

    if (!config.latamRosterFallbackIflight()) {
      throw new Error(
        probe.lastError ??
          'eCrew não devolveu artefatos. Configure LATAM_ECREW_ENTRY_URL ou ative LATAM_ROSTER_FALLBACK_IFLIGHT.',
      );
    }
  } else {
    await appendLog({
      step: 'ecrew_skip',
      reason: 'LATAM_ECREW_ENTRY_URL não definida — indo direto ao SAB → iFlight Neo',
    });
  }

  // ── SAB → iFlight Neo (rota principal) ───────────────────────────────────────
  await appendLog({ step: 'sab_iflight_start', message: 'Iniciando pipeline SAB → iFlight Neo → CrewRosterReport' });
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
