/**
 * Orquestração LATAM: SSO → eCrew Rota de Ouro (GET RosterReport HTML/PDF) → importação;
 * fallback opcional SAB→iFlight (`LATAM_ROSTER_FALLBACK_IFLIGHT=1`).
 * MFA / expiração: reconnect_required quando o storageState deixa de ser válido.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import { config } from '../../config.js';
import { getServiceClient, type AutomationStatusRow } from '../../db.js';
import { saveFailureArtifacts } from '../../artifacts.js';
import { log } from '../../logger.js';
import { expectAuthenticatedHome, waitForAuthenticationAfterSso } from './navigation.js';
import { persistFsmTransition, patchOrchestrationSnapshot } from './corporate-automation-orchestrator.js';
import { detectCorporateSurface } from './surface-detector.js';
import { runLatamGoldPathRosterImport } from './latam-production-pipeline.js';
import type { CorporateFsmState } from './fsm-types.js';
import { PostLoginNavigationInstrument } from './post-login-navigation-instrumentation.js';

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
  extra?: { error_message?: string; imported_roster_id?: string; finished?: boolean; fsm_state?: CorporateFsmState },
): Promise<void> {
  const supabase = getServiceClient();
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (extra?.error_message !== undefined) patch.error_message = extra.error_message;
  if (extra?.imported_roster_id !== undefined) patch.imported_roster_id = extra.imported_roster_id;
  if (extra?.finished) patch.finished_at = new Date().toISOString();
  if (extra?.fsm_state !== undefined) patch.fsm_state = extra.fsm_state;
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
  await persistFsmTransition({ runId, sessionId, fsm: 'starting' });

  let context: BrowserContext | null = null;
  let postLoginInstrument: PostLoginNavigationInstrument | null = null;
  try {
    context = await chromium.launchPersistentContext(sessionDir(userId), {
      headless: config.headless(),
      viewport: { width: 1400, height: 900 },
      locale: 'pt-BR',
      acceptDownloads: true,
    });
    const page = context.pages()[0] ?? (await context.newPage());
    page.setDefaultTimeout(90_000);

    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await appendRunLog(runId, { step: 'portal_opened', message: 'URL do portal carregada' });
    await appendRunLog(runId, { step: 'portal_connecting', message: 'À espera de autenticação (SSO Microsoft/Google → LATAM)' });

    let lastSsoSurface = '';
    await persistFsmTransition({
      runId,
      sessionId,
      fsm: 'opening_corporate_portal',
      snapshot: {
        current_url: page.url(),
        current_host: new URL(page.url()).hostname,
      },
      markSuccess: true,
    });

    const authed = await waitForAuthenticationAfterSso(page, context, {
      deadlineMs: 25 * 60_000,
      waitForUrlTimeoutMs: 120_000,
      appendLog: (e) => appendRunLog(runId, e),
      onPoll: async (info) => {
        await patchOrchestrationSnapshot(runId, {
          current_url: info.url,
          current_host: info.host,
          last_surface: info.surface,
        });
        if (info.fsmHint !== 'waiting_sso') return;
        if (info.surface === lastSsoSurface) return;
        lastSsoSurface = info.surface;
        await persistFsmTransition({
          runId,
          sessionId,
          fsm: 'waiting_sso',
          snapshot: {
            current_url: info.url,
            current_host: info.host,
            last_surface: info.surface,
          },
        });
        await appendRunLog(runId, {
          step: 'fsm_transition',
          fsm: 'waiting_sso',
          surface: info.surface,
          message: 'Superfície SSO detetada — aguardando retorno ao portal LATAM',
        });
      },
    });

    if (!authed) {
      await appendRunLog(runId, { step: 'session_validated', ok: false, message: 'Timeout — home autenticada não detetada' });
      await appendRunLog(runId, { step: 'error', message: 'Timeout de autenticação (MFA ou login incompleto)' });
      await saveFailureArtifacts(page, failDir, 'portal-auth-timeout');
      await persistFsmTransition({
        runId,
        sessionId,
        fsm: 'needs_user_interaction',
        snapshot: { last_surface: 'auth_timeout' },
        finished: true,
        lastError: 'Sessão não detetada a tempo — complete o login e use Reconectar',
      });
      await getServiceClient()
        .from('automation_runs')
        .update({
          error_message: 'Timeout de autenticação',
          updated_at: new Date().toISOString(),
        })
        .eq('id', runId);
      return;
    }

    await appendRunLog(runId, { step: 'session_validated', ok: true, message: 'Sessão ativa no portal' });
    await persistFsmTransition({
      runId,
      sessionId,
      fsm: 'authenticated',
      snapshot: {
        current_url: page.url(),
        current_host: new URL(page.url()).hostname,
        last_surface: (await detectCorporateSurface(page)).surface,
      },
      markSuccess: true,
    });
    await appendRunLog(runId, {
      step: 'portal_connected',
      message: 'Autenticação OK — eCrew Rota de Ouro (GET RosterReport HTML/PDF) com fallback UI',
    });

    postLoginInstrument = new PostLoginNavigationInstrument();
    postLoginInstrument.attachToBrowserContext(context, (e) => {
      void appendRunLog(runId, e);
    });

    try {
      const onFsmPhase = async (phase: CorporateFsmState) => {
        const det = await detectCorporateSurface(page).catch(() => null);
        await persistFsmTransition({
          runId,
          sessionId,
          fsm: phase,
          snapshot: {
            current_url: page.url(),
            current_host: new URL(page.url()).hostname,
            last_surface: det?.surface ?? phase,
          },
          markSuccess: true,
        });
        await appendRunLog(runId, { step: 'fsm_transition', fsm: phase });
      };

      const { rosterId, mode } = await runLatamGoldPathRosterImport({
        context,
        page,
        userId,
        runId,
        sessionUserDir: sessionDir(userId),
        appendLog: (e) => appendRunLog(runId, e),
        onFsmPhase,
        instrument: postLoginInstrument ?? undefined,
        persistNavigationDebug: async (payload) => {
          await patchOrchestrationSnapshot(runId, {
            navigation_debug: payload as unknown as Record<string, unknown>,
          });
        },
      });

      await appendRunLog(runId, {
        step: 'roster_detected',
        message:
          mode === 'ecrew'
            ? 'RosterReport obtido via eCrew (GET / fallback UI)'
            : 'RosterReport via fallback SAB/iFlight (LATAM_ROSTER_FALLBACK_IFLIGHT)',
        mode,
      });

      await appendRunLog(runId, { step: 'roster_importing', message: 'Importação concluída no EscalaX' });
      await persistFsmTransition({ runId, sessionId, fsm: 'importing_report' });

      await getServiceClient().from('automation_runs').update({ imported_roster_id: rosterId }).eq('id', runId);
      await persistFsmTransition({
        runId,
        sessionId,
        fsm: 'completed',
        markSuccess: true,
        finished: true,
      });
      await appendRunLog(runId, { step: 'roster_imported', rosterId });
      await appendRunLog(runId, { step: 'completed', message: 'Importação e ativação concluídas' });
      await appendRunLog(runId, { step: 'roster_connected', rosterId });
      log(SCOPE, 'info', 'connect_full_ok', { userId, sessionId, rosterId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await appendRunLog(runId, { step: 'pipeline_partial', message: msg, note: 'Sessão será gravada para nova tentativa (Sincronizar)' });
      await saveFailureArtifacts(page, failDir, 'connect-pipeline-partial');
      const snapRow = await getServiceClient().from('automation_runs').select('orchestration_snapshot').eq('id', runId).single();
      const prevSnap = (snapRow.data as { orchestration_snapshot?: Record<string, unknown> } | null)?.orchestration_snapshot ?? {};
      await getServiceClient()
        .from('automation_runs')
        .update({
          status: 'portal_connected',
          fsm_state: 'authenticated',
          error_message: msg,
          finished_at: new Date().toISOString(),
          orchestration_snapshot: { ...prevSnap, last_surface: 'pipeline_partial' },
          updated_at: new Date().toISOString(),
        })
        .eq('id', runId);
      await setSessionStatus(sessionId, 'portal_connected', msg);
      log(SCOPE, 'warn', 'connect_pipeline_incomplete', { message: msg });
    }

    await persistStorage(context, storePath, sessionId);
    await appendRunLog(runId, { step: 'storage_persisted', path: storePath });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(SCOPE, 'error', 'connect_fail', { message: msg });
    await persistFsmTransition({
      runId,
      sessionId,
      fsm: 'failed',
      finished: true,
      lastError: msg,
    });
    await getServiceClient()
      .from('automation_runs')
      .update({ error_message: msg, updated_at: new Date().toISOString() })
      .eq('id', runId);
    await setSessionStatus(sessionId, 'error', msg);
  } finally {
    postLoginInstrument?.dispose();
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

  let context: BrowserContext | null = null;
  let browser: Browser | null = null;
  let syncInstrument: PostLoginNavigationInstrument | null = null;

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
  await persistFsmTransition({ runId, sessionId, fsm: 'starting' });

  browser = await chromium.launch({ headless: config.headless() });

  try {
    context = await browser.newContext({
      storageState: storePath,
      viewport: { width: 1400, height: 900 },
      locale: 'pt-BR',
      acceptDownloads: true,
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
      await persistFsmTransition({
        runId,
        sessionId,
        fsm: 'needs_user_interaction',
        finished: true,
        lastError: 'Reautenticar no portal',
      });
      await getServiceClient()
        .from('automation_runs')
        .update({ error_message: 'Sessão inválida', updated_at: new Date().toISOString() })
        .eq('id', runId);
      await context.close();
      context = null;
      await browser.close();
      browser = null;
      return;
    }

    await appendRunLog(runId, { step: 'session_validated', ok: true, message: 'Sessão ativa no portal' });
    await persistFsmTransition({
      runId,
      sessionId,
      fsm: 'authenticated',
      snapshot: {
        current_url: page.url(),
        current_host: new URL(page.url()).hostname,
        last_surface: (await detectCorporateSurface(page)).surface,
      },
      markSuccess: true,
    });

    syncInstrument = new PostLoginNavigationInstrument();
    syncInstrument.attachToBrowserContext(context, (e) => {
      void appendRunLog(runId, e);
    });

    const onFsmPhase = async (phase: CorporateFsmState) => {
      const det = await detectCorporateSurface(page).catch(() => null);
      await persistFsmTransition({
        runId,
        sessionId,
        fsm: phase,
        snapshot: {
          current_url: page.url(),
          current_host: new URL(page.url()).hostname,
          last_surface: det?.surface ?? phase,
        },
        markSuccess: true,
      });
      await appendRunLog(runId, { step: 'fsm_transition', fsm: phase });
    };

    const { rosterId } = await runLatamGoldPathRosterImport({
      context,
      page,
      userId,
      runId,
      sessionUserDir: sessionDir(userId),
      appendLog: (e) => appendRunLog(runId, e),
      onFsmPhase,
      instrument: syncInstrument ?? undefined,
      persistNavigationDebug: async (payload) => {
        await patchOrchestrationSnapshot(runId, {
          navigation_debug: payload as unknown as Record<string, unknown>,
        });
      },
    });

    await appendRunLog(runId, { step: 'roster_importing', message: 'Importação concluída no EscalaX' });
    await persistFsmTransition({ runId, sessionId, fsm: 'importing_report' });

    await getServiceClient().from('automation_runs').update({ imported_roster_id: rosterId }).eq('id', runId);

    await persistFsmTransition({
      runId,
      sessionId,
      fsm: 'completed',
      markSuccess: true,
      finished: true,
    });
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
    await persistFsmTransition({ runId, sessionId, fsm: 'failed', finished: true, lastError: msg });
    await getServiceClient()
      .from('automation_runs')
      .update({ error_message: msg, updated_at: new Date().toISOString() })
      .eq('id', runId);
    await setSessionStatus(sessionId, 'error', msg);
    log(SCOPE, 'error', 'sync_fail', { message: msg });
  } finally {
    syncInstrument?.dispose();
    await context?.close();
    if (browser) await browser.close();
  }
}
