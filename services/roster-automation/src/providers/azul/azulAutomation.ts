/**
 * Azul CAE — MonthlySchedule / iframe; importação PDF ou HTML (parser LATAM como melhor esforço).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, type BrowserContext } from 'playwright';
import { config } from '../../config.js';
import { getServiceClient, type AutomationStatusRow } from '../../db.js';
import { saveFailureArtifacts } from '../../artifacts.js';
import { log } from '../../logger.js';
import { importDownloadedPdf, importLatamHtmlReportBuffer } from '../../importAdapter.js';
import { persistFsmTransition } from '../latam/corporate-automation-orchestrator.js';
import { runAzulCaeCapture } from './azul-cae-capture.js';

const SCOPE = 'azul';

function sessionDir(userId: string): string {
  return path.join(config.dataDir(), 'azul', userId);
}

function storageStatePath(userId: string): string {
  return path.join(sessionDir(userId), 'storage.json');
}

async function appendRunLog(runId: string, entry: Record<string, unknown>): Promise<void> {
  const supabase = getServiceClient();
  const { data: row } = await supabase.from('automation_runs').select('step_logs').eq('id', runId).single();
  const prev = (row as { step_logs?: unknown[] } | null)?.step_logs ?? [];
  const next = [...prev, { at: new Date().toISOString(), ...entry }];
  await supabase.from('automation_runs').update({ step_logs: next, updated_at: new Date().toISOString() }).eq('id', runId);
  log(SCOPE, 'info', 'run_step', { runId, ...entry });
}

async function setSessionStatus(sessionId: string, status: AutomationStatusRow, err?: string): Promise<void> {
  await getServiceClient()
    .from('automation_sessions')
    .update({ status, last_error: err ?? null, updated_at: new Date().toISOString() })
    .eq('id', sessionId);
}

async function persistStorage(context: BrowserContext, storePath: string, sessionId: string): Promise<void> {
  await context.storageState({ path: storePath });
  await getServiceClient()
    .from('automation_sessions')
    .update({
      storage_state_path: path.relative(config.dataDir(), storePath),
      session_valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
}

export async function startAzulConnectFlow(params: { userId: string; sessionId: string; runId: string }): Promise<void> {
  const { userId, sessionId, runId } = params;
  const storePath = storageStatePath(userId);
  const failDir = path.join(sessionDir(userId), 'failures');
  await fs.mkdir(sessionDir(userId), { recursive: true });

  let context: BrowserContext | null = null;
  try {
    context = await chromium.launchPersistentContext(sessionDir(userId), {
      headless: config.headless(),
      viewport: { width: 1400, height: 900 },
      locale: 'pt-BR',
      acceptDownloads: true,
    });
    const page = context.pages()[0] ?? (await context.newPage());
    page.setDefaultTimeout(90_000);

    await page.goto(config.azulCaeBaseUrl(), { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await appendRunLog(runId, { step: 'azul_portal_open', url: page.url() });
    await persistFsmTransition({
      runId,
      sessionId,
      fsm: 'opening_corporate_portal',
      snapshot: { current_url: page.url() },
      markSuccess: true,
    });

    await appendRunLog(runId, {
      step: 'azul_user_action',
      message: 'Autentique-se no CAE Azul no browser. Aguardando…',
    });
    const preMs = Number(process.env.AZUL_LOGIN_WAIT_MS ?? '45000');
    await page.waitForTimeout(Math.min(Math.max(preMs, 5_000), 300_000));

    const captureDir = path.join(sessionDir(userId), 'captures');
    const { pdfPath, htmlPath } = await runAzulCaeCapture(page, captureDir, (e) => appendRunLog(runId, e));

    const supabase = getServiceClient();
    let rosterId: string | null = null;

    if (pdfPath) {
      const buf = await fs.readFile(pdfPath);
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      const imp = await importDownloadedPdf({
        supabase,
        userId,
        fileName: path.basename(pdfPath),
        pdfBytes: ab,
        automationRunId: runId,
        importOrigin: 'azul_automation',
      });
      if (!imp.success || !imp.rosterId) throw new Error(imp.error ?? 'Importação PDF Azul falhou');
      if (imp.insertedCount === 0 && !imp.duplicate) throw new Error('Login realizado, mas nenhuma escala foi importada.');
      rosterId = imp.rosterId;
    } else if (htmlPath) {
      const htmlUtf8 = await fs.readFile(htmlPath);
      const imp = await importLatamHtmlReportBuffer({
        supabase,
        userId,
        fileName: path.basename(htmlPath),
        htmlUtf8,
        automationRunId: runId,
        importOrigin: 'azul_automation',
      });
      if (!imp.success || !imp.rosterId) throw new Error(imp.error ?? 'Importação HTML Azul falhou');
      if (imp.insertedCount === 0 && !imp.duplicate) throw new Error('Login realizado, mas nenhuma escala foi importada.');
      rosterId = imp.rosterId;
    } else {
      await saveFailureArtifacts(page, failDir, 'azul-no-artifact');
      throw new Error('Defina AZUL_MONTHLY_SCHEDULE_URL ou conclua o fluxo até existir MonthlySchedule/iframe com conteúdo');
    }

    await supabase.from('automation_runs').update({ imported_roster_id: rosterId }).eq('id', runId);
    await persistFsmTransition({ runId, sessionId, fsm: 'completed', markSuccess: true, finished: true });
    await appendRunLog(runId, { step: 'azul_completed', rosterId });
    await persistStorage(context, storePath, sessionId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await appendRunLog(runId, { step: 'error', message: msg });
    await persistFsmTransition({ runId, sessionId, fsm: 'failed', finished: true, lastError: msg });
    await getServiceClient().from('automation_runs').update({ error_message: msg }).eq('id', runId);
    await setSessionStatus(sessionId, 'error', msg);
  } finally {
    await context?.close();
  }
}
