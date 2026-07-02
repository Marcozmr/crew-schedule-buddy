/**
 * Orquestração LATAM: SSO → SAB → iFlight Neo → CrewRosterReport (PDF) → importação.
 * eCrew é opcional — só usado se `LATAM_ECREW_ENTRY_URL` estiver definida.
 * MFA / expiração: reconnect_required quando o storageState deixa de ser válido.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
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
import { decryptSession } from '../../session-crypto.js';
import { attachRemoteSession, detachRemoteSession } from '../../remote-session/registry.js';

const SCOPE = 'latam';

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Tenta navegar por uma lista de URLs em cascata.
 * Para cada URL tenta primeiro 'domcontentloaded', depois 'commit' (mais permissivo).
 * Lança erro claro se todas falharem — sem loops infinitos.
 */
async function navigateWithFallback(
  page: Page,
  urls: string[],
  appendLog: (entry: Record<string, unknown>) => Promise<void>,
): Promise<void> {
  const strategies = [
    { waitUntil: 'domcontentloaded' as const, timeout: 60_000 },
    { waitUntil: 'commit' as const, timeout: 30_000 },
  ];

  for (const url of urls) {
    for (const { waitUntil, timeout } of strategies) {
      try {
        await page.goto(url, { waitUntil, timeout });
        await appendLog({ step: 'portal_navigate_ok', url, waitUntil });
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await appendLog({
          step: 'portal_navigate_fail',
          url,
          waitUntil,
          error: msg.slice(0, 300),
        });
      }
    }
  }

  throw new Error(
    'Não foi possível abrir o portal LATAM pelo servidor. ' +
      'Tente novamente em alguns minutos ou use importação manual do CrewRosterReport.',
  );
}

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

  // Ordem de tentativa: SAB direto → corporativo-latam → iFlight (nunca a raiz do portal, que causa ERR_HTTP2)
  const entryUrls = [
    config.latamPortalSabUrl(),
    'https://portal.latam.com/pt/group/corporativo-latam',
    config.iflightDeepLinkUrl(),
  ].filter(Boolean);

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
      timezoneId: 'America/Sao_Paulo',
      acceptDownloads: true,
      ignoreHTTPSErrors: true,
      userAgent: CHROME_UA,
      extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' },
    });
    const page = context.pages()[0] ?? (await context.newPage());
    page.setDefaultTimeout(90_000);

    await navigateWithFallback(page, entryUrls, (e) => appendRunLog(runId, e));
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
        // Liga o navegador remoto (screencast + input) assim que o SSO real é detetado —
        // idempotente, a página só é anexada uma vez mesmo com múltiplos polls.
        void attachRemoteSession(runId, page);
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

    await detachRemoteSession(runId, authed ? 'authenticated' : 'failed');

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
      message: 'Login confirmado — navegando ao SAB → iFlight Neo',
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
    await detachRemoteSession(runId, 'failed');
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

  // Carrega storageState: blob cifrado na BD (extensão) → ficheiro em disco (Playwright legado)
  type StorageStateObj = {
    cookies: Array<{
      name: string; value: string; domain: string; path: string;
      expires: number; httpOnly: boolean; secure: boolean; sameSite: 'Strict' | 'Lax' | 'None';
    }>;
    origins: Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>;
  };

  let storageStateArg: string | StorageStateObj = storePath;

  const { data: sessionRow } = await getServiceClient()
    .from('automation_sessions')
    .select('encrypted_session_blob')
    .eq('id', sessionId)
    .single();

  const encryptedBlob = (sessionRow as { encrypted_session_blob?: string } | null)?.encrypted_session_blob ?? null;

  if (encryptedBlob) {
    try {
      storageStateArg = JSON.parse(decryptSession(encryptedBlob, config.sessionEncryptionKey())) as StorageStateObj;
      await appendRunLog(runId, { step: 'session_restored', message: 'Sessão restaurada do blob cifrado (extensão)' });
    } catch (decryptErr) {
      const msg = decryptErr instanceof Error ? decryptErr.message : String(decryptErr);
      log(SCOPE, 'error', 'session_decrypt_failed', { sessionId, message: msg });
      await setRunStatus(runId, 'reconnect_required', {
        error_message: 'Falha a decifrar sessão — reconecte via extensão',
        finished: true,
      });
      await setSessionStatus(sessionId, 'reconnect_required', 'Falha a decifrar sessão');
      return;
    }
  } else {
    try {
      await fs.access(storePath);
      await appendRunLog(runId, { step: 'session_restored', message: 'storageState encontrado em disco' });
    } catch {
      await setRunStatus(runId, 'reconnect_required', {
        error_message: 'Sem sessão gravada — use a extensão EscalaX para conectar',
        finished: true,
      });
      await setSessionStatus(sessionId, 'reconnect_required', 'Sem storageState');
      return;
    }
  }

  await appendRunLog(runId, { step: 'sync_start', message: 'Sincronização com storageState restaurado' });
  await persistFsmTransition({ runId, sessionId, fsm: 'starting' });

  browser = await chromium.launch({ headless: config.headless() });

  try {
    context = await browser.newContext({
      storageState: storageStateArg,
      viewport: { width: 1400, height: 900 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      acceptDownloads: true,
      ignoreHTTPSErrors: true,
      userAgent: CHROME_UA,
      extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(90_000);

    const syncEntryUrls = [
      config.latamPortalSabUrl(),
      'https://portal.latam.com/pt/group/corporativo-latam',
      config.iflightDeepLinkUrl(),
    ].filter(Boolean);
    await navigateWithFallback(page, syncEntryUrls, (e) => appendRunLog(runId, e));
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
