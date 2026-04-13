/**
 * Orquestração LATAM: portal → SAB → iFlightNeo → CrewRosterReport PDF → importação.
 * MFA / expiração: reconnect_required quando o storageState deixa de ser válido.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import { config } from '../../config.js';
import { getServiceClient, type AutomationStatusRow } from '../../db.js';
import { saveFailureArtifacts } from '../../artifacts.js';
import { log } from '../../logger.js';
import { importDownloadedPdf } from '../../importAdapter.js';
import { expectAuthenticatedHome, waitForAuthenticationAfterSso } from './navigation.js';
import { runSabToCrewRosterPdf } from './sab-iflight-pipeline.js';

const SCOPE = 'latam';

function sessionDir(userId: string): string {
  return path.join(config.dataDir(), 'latam', userId);
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
  const supabase = getServiceClient();
  await supabase
    .from('automation_sessions')
    .update({
      status,
      last_error: err ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
}

async function setRunStatus(
  runId: string,
  status: AutomationStatusRow,
  extra?: { error_message?: string; imported_roster_id?: string; finished?: boolean },
): Promise<void> {
  const supabase = getServiceClient();
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (extra?.error_message !== undefined) patch.error_message = extra.error_message;
  if (extra?.imported_roster_id !== undefined) patch.imported_roster_id = extra.imported_roster_id;
  if (extra?.finished) patch.finished_at = new Date().toISOString();
  await supabase.from('automation_runs').update(patch).eq('id', runId);
}

const SESSION_VALID_DAYS = 7;

async function persistStorage(context: BrowserContext, storePath: string, sessionId: string): Promise<void> {
  await context.storageState({ path: storePath });
  const validUntil = new Date(Date.now() + SESSION_VALID_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await getServiceClient()
    .from('automation_sessions')
    .update({
      storage_state_path: path.relative(config.dataDir(), storePath),
      session_valid_until: validUntil,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
}

async function importPdfBuffer(params: {
  userId: string;
  runId: string;
  fileName: string;
  buffer: Buffer;
}): Promise<{ rosterId: string }> {
  const { userId, runId, fileName, buffer } = params;
  const supabase = getServiceClient();
  const pdfBuf = new Uint8Array(buffer).buffer;
  const imp = await importDownloadedPdf({
    supabase,
    userId,
    fileName,
    pdfBytes: pdfBuf,
    automationRunId: runId,
  });
  if (!imp.success || !imp.rosterId) {
    throw new Error(imp.error ?? 'Falha na importação do PDF');
  }
  return { rosterId: imp.rosterId };
}

/**
 * Ligação inicial: login → (opcional) pipeline SAB→iFlight→PDF→import no mesmo browser persistente.
 */
export async function startConnectFlow(params: {
  userId: string;
  sessionId: string;
  runId: string;
}): Promise<void> {
  const { userId, sessionId, runId } = params;
  const loginUrl = config.latamPortalLoginUrl();
  if (!loginUrl) {
    await setRunStatus(runId, 'error', { error_message: 'LATAM_PORTAL_LOGIN_URL não configurada no worker', finished: true });
    await setSessionStatus(sessionId, 'error', 'LATAM_PORTAL_LOGIN_URL ausente');
    return;
  }

  await fs.mkdir(sessionDir(userId), { recursive: true });
  const storePath = storageStatePath(userId);
  const failDir = path.join(sessionDir(userId), 'failures');

  try {
    await fs.access(storePath);
    await appendRunLog(runId, {
      step: 'session_restored',
      message: 'Encontrado storageState anterior — o browser persistente pode reutilizar cookies',
    });
  } catch {
    await appendRunLog(runId, { step: 'session_restored', message: 'Primeira ligação — sem storage anterior' });
  }

  await appendRunLog(runId, { step: 'portal_connecting', message: 'A abrir Chromium e navegar ao portal' });
  await setSessionStatus(sessionId, 'portal_connecting');
  await setRunStatus(runId, 'portal_connecting');

  let context: BrowserContext | null = null;
  try {
    context = await chromium.launchPersistentContext(sessionDir(userId), {
      headless: config.headless(),
      viewport: { width: 1400, height: 900 },
      locale: 'pt-BR',
    });
    const page = context.pages()[0] ?? (await context.newPage());
    page.setDefaultTimeout(90_000);

    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await appendRunLog(runId, { step: 'portal_opened', message: 'URL do portal carregada' });
    await appendRunLog(runId, { step: 'portal_connecting', message: 'À espera de autenticação (incl. SSO Microsoft → LATAM)' });

    const authed = await waitForAuthenticationAfterSso(page, context, {
      deadlineMs: 25 * 60_000,
      waitForUrlTimeoutMs: 120_000,
      appendLog: (e) => appendRunLog(runId, e),
    });

    if (!authed) {
      await appendRunLog(runId, { step: 'session_validated', ok: false, message: 'Timeout — home autenticada não detetada' });
      await appendRunLog(runId, { step: 'error', message: 'Timeout de autenticação (MFA ou login incompleto)' });
      await saveFailureArtifacts(page, failDir, 'portal-auth-timeout');
      await setRunStatus(runId, 'error', { error_message: 'Timeout de autenticação', finished: true });
      await setSessionStatus(sessionId, 'reconnect_required', 'Sessão não detetada a tempo');
      return;
    }

    await appendRunLog(runId, { step: 'session_validated', ok: true, message: 'Sessão ativa no portal' });
    await appendRunLog(runId, { step: 'portal_connected', message: 'Sessão portal OK — a iniciar SAB → iFlightNeo → PDF' });
    await setSessionStatus(sessionId, 'portal_connected');
    await setRunStatus(runId, 'portal_connected');

    try {
      await setRunStatus(runId, 'iflight_detected');
      await setSessionStatus(sessionId, 'iflight_detected');
      await appendRunLog(runId, { step: 'iflight_accessed', message: 'Pipeline SAB → iFlightNeo em execução' });

      const { buffer, fileName } = await runSabToCrewRosterPdf({
        context,
        page,
        userId,
        runId,
        failDir,
        appendLog: (e) => appendRunLog(runId, e),
      });

      await appendRunLog(runId, { step: 'roster_detected', message: 'CrewRosterReport localizado (SAB / iFlight)' });
      await appendRunLog(runId, { step: 'pdf_downloaded', fileName, bytes: buffer.length });

      await appendRunLog(runId, { step: 'roster_importing', message: 'A importar PDF no EscalaX' });
      await setRunStatus(runId, 'roster_importing');
      await setSessionStatus(sessionId, 'roster_importing');

      const { rosterId } = await importPdfBuffer({ userId, runId, fileName, buffer });

      await getServiceClient().from('automation_runs').update({ imported_roster_id: rosterId }).eq('id', runId);
      await setRunStatus(runId, 'roster_connected', { imported_roster_id: rosterId, finished: true });
      await setSessionStatus(sessionId, 'roster_connected');
      await appendRunLog(runId, { step: 'roster_imported', rosterId });
      await appendRunLog(runId, { step: 'completed', message: 'Importação e ativação concluídas' });
      await appendRunLog(runId, { step: 'roster_connected', rosterId });
      log(SCOPE, 'info', 'connect_full_ok', { userId, sessionId, rosterId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await appendRunLog(runId, { step: 'pipeline_partial', message: msg, note: 'Sessão será gravada para nova tentativa (Sincronizar)' });
      await saveFailureArtifacts(page, failDir, 'connect-pipeline-partial');
      await setRunStatus(runId, 'portal_connected', { error_message: msg, finished: true });
      await setSessionStatus(sessionId, 'portal_connected', msg);
      log(SCOPE, 'warn', 'connect_pipeline_incomplete', { message: msg });
    }

    await persistStorage(context, storePath, sessionId);
    await appendRunLog(runId, { step: 'storage_persisted', path: storePath });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(SCOPE, 'error', 'connect_fail', { message: msg });
    await setRunStatus(runId, 'error', { error_message: msg, finished: true });
    await setSessionStatus(sessionId, 'error', msg);
  } finally {
    await context?.close();
  }
}

/**
 * Sincronização com storage já gravado (nova aba Chromium + storageState).
 */
export async function runSyncFlow(params: { userId: string; sessionId: string; runId: string }): Promise<void> {
  const { userId, sessionId, runId } = params;
  const storePath = storageStatePath(userId);
  const failDir = path.join(sessionDir(userId), 'failures');

  let raw: Buffer | null = null;
  let context: BrowserContext | null = null;
  let browser: Browser | null = null;

  try {
    await fs.access(storePath);
    await appendRunLog(runId, { step: 'session_restored', message: 'storageState encontrado em disco' });
  } catch {
    await setRunStatus(runId, 'reconnect_required', {
      error_message: 'Sem sessão gravada — ligue o portal primeiro',
      finished: true,
    });
    await setSessionStatus(sessionId, 'reconnect_required', 'Sem storageState');
    return;
  }

  await appendRunLog(runId, { step: 'sync_start', message: 'Sincronização com storageState restaurado' });
  await setRunStatus(runId, 'roster_downloading');
  await setSessionStatus(sessionId, 'roster_downloading');

  browser = await chromium.launch({ headless: config.headless() });

  try {
    context = await browser.newContext({
      storageState: storePath,
      viewport: { width: 1400, height: 900 },
      locale: 'pt-BR',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(90_000);

    const entry = config.latamPortalLoginUrl() || 'about:blank';
    await page.goto(entry, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await appendRunLog(runId, { step: 'portal_opened', message: 'Portal carregado com cookies da sessão' });

    if (!(await expectAuthenticatedHome(page, context))) {
      await appendRunLog(runId, { step: 'session_validated', ok: false, message: 'Sessão inválida ou expirada' });
      await appendRunLog(runId, { step: 'reconnect_required', message: 'Sessão expirada ou MFA necessário' });
      await saveFailureArtifacts(page, failDir, 'session-expired');
      await setRunStatus(runId, 'reconnect_required', { error_message: 'Sessão inválida', finished: true });
      await setSessionStatus(sessionId, 'reconnect_required', 'Reautenticar no portal');
      await context.close();
      context = null;
      await browser.close();
      browser = null;
      return;
    }

    await appendRunLog(runId, { step: 'session_validated', ok: true, message: 'Sessão ativa no portal' });

    await setRunStatus(runId, 'iflight_detected');
    await setSessionStatus(sessionId, 'iflight_detected');
    await appendRunLog(runId, { step: 'iflight_accessed', message: 'Pipeline SAB → iFlightNeo em execução' });

    const { buffer, fileName } = await runSabToCrewRosterPdf({
      context,
      page,
      userId,
      runId,
      failDir,
      appendLog: (e) => appendRunLog(runId, e),
    });
    raw = buffer;

    await appendRunLog(runId, { step: 'roster_detected', message: 'CrewRosterReport localizado (SAB / iFlight)' });
    await appendRunLog(runId, { step: 'pdf_downloaded', fileName, bytes: raw.length });

    await appendRunLog(runId, { step: 'roster_importing', message: 'A importar PDF no EscalaX' });
    await setRunStatus(runId, 'roster_importing');
    await setSessionStatus(sessionId, 'roster_importing');

    const { rosterId } = await importPdfBuffer({ userId, runId, fileName, buffer: raw });

    await getServiceClient().from('automation_runs').update({ imported_roster_id: rosterId }).eq('id', runId);

    await setRunStatus(runId, 'roster_connected', { imported_roster_id: rosterId, finished: true });
    await setSessionStatus(sessionId, 'roster_connected');
    await appendRunLog(runId, { step: 'roster_imported', rosterId });
    await appendRunLog(runId, { step: 'completed', message: 'Sincronização concluída' });
    await appendRunLog(runId, { step: 'roster_connected', rosterId });
    log(SCOPE, 'info', 'sync_ok', { userId, rosterId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await appendRunLog(runId, { step: 'error', message: msg });
    if (context) {
      for (const p of context.pages()) {
        await saveFailureArtifacts(p, failDir, 'sync-error');
      }
    }
    await setRunStatus(runId, 'error', { error_message: msg, finished: true });
    await setSessionStatus(sessionId, 'error', msg);
    log(SCOPE, 'error', 'sync_fail', { message: msg });
  } finally {
    await context?.close();
    if (browser) await browser.close();
  }
}
