/**
 * SAB → contexto tripulante → iFlightNeo (com fallbacks) → escala → CrewRosterReport (PDF).
 */
import path from 'node:path';
import type { BrowserContext, Frame, Page } from 'playwright';
import { log } from '../../logger.js';
import { saveFailureArtifacts } from '../../artifacts.js';
import { withRetries } from '../../retry.js';
import { waitForSabPortalSurface } from './navigation.js';
import { clickSabCrewHeaderContext } from './sab-crew-header.js';
import { openIFlightNeoWithFallbacks } from './iflight-launcher.js';
import type { LocatorRoot } from './latam-shared-dom.js';
import type { CorporateFsmState } from './fsm-types.js';
import type { PostLoginNavigationInstrument, NavigationDebugPayload } from './post-login-navigation-instrumentation.js';
import { capturePdfDownloadOrResponse } from './pdf-capture-hybrid.js';

export type { LocatorRoot } from './latam-shared-dom.js';
export { IFIGHT_NEO_TEXT_PATTERNS, findIFlightNeoTile, pickIFlightFrame, pickRosterRoot } from './latam-shared-dom.js';

const SCOPE = 'sab-iflight';

export type PipelineLogFn = (entry: Record<string, unknown>) => Promise<void>;

async function artifact(page: Page | null, failDir: string, tag: string, appendLog: PipelineLogFn): Promise<void> {
  if (!page) return;
  const out = await saveFailureArtifacts(page, failDir, tag);
  await appendLog({
    step: 'artifact_saved',
    tag,
    screenshotPath: out.screenshotPath,
    htmlPath: out.htmlPath,
  });
  log(SCOPE, 'warn', 'failure_artifact', { tag, ...out });
}

export async function waitForRosterShell(root: LocatorRoot, appendLog: PipelineLogFn, timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const t = await root.locator('body').innerText({ timeout: 8_000 }).catch(() => '');
    if (
      /crew\s*roster|CrewRoster|minha escala|my roster|per[ií]odo|duty|pairing|JJ\d{3,4}|Flight\s*Schedule/i.test(t)
    ) {
      await appendLog({ step: 'roster_screen', ok: true, sample: t.slice(0, 240) });
      return;
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  await appendLog({ step: 'roster_screen', ok: false, message: 'Timeout à espera de conteúdo tipo escala' });
  throw new Error('Timeout: ecrã da escala não identificado no iFlight');
}

/** @deprecated usar capturePdfDownloadOrResponse — mantido para testes diretos */
export async function downloadCrewRosterPdfFromRoot(
  workPage: Page,
  root: LocatorRoot,
  appendLog: PipelineLogFn,
  failDir: string,
  instrument?: PostLoginNavigationInstrument,
): Promise<{ buffer: Buffer; suggestedName: string }> {
  return capturePdfDownloadOrResponse(workPage, root, appendLog, failDir, instrument);
}

export type SabPipelineResult = { buffer: Buffer; fileName: string };

export async function runSabToCrewRosterPdf(params: {
  context: BrowserContext;
  page: Page;
  userId: string;
  runId: string;
  failDir: string;
  appendLog: PipelineLogFn;
  /** Sincroniza FSM com marcos do pipeline (SAB → iFlight → roster → PDF). */
  onFsmPhase?: (phase: CorporateFsmState) => void | Promise<void>;
  instrument?: PostLoginNavigationInstrument;
  /** Persiste snapshot técnico em `orchestration_snapshot.navigation_debug`. */
  persistNavigationDebug?: (payload: NavigationDebugPayload) => Promise<void>;
}): Promise<SabPipelineResult> {
  const { context, page, runId, failDir, appendLog, onFsmPhase, instrument, persistNavigationDebug } = params;

  await appendLog({ step: 'pipeline_start', runId, phase: 'sab_iflight_crewroster' });

  await onFsmPhase?.('opening_portal_sab');
  await withRetries('wait_sab', 5, 3_000, async () => {
    const ok = await waitForSabPortalSurface(page);
    if (!ok) throw new Error('SAB / tile iFlightNeo ainda não visível');
  });
  await appendLog({ step: 'sab_surface', ok: true, url: page.url(), step_tag: 'sab_entry_detected' });
  if (instrument) {
    const dbg = await instrument.buildTechnicalSnapshot(page, 'sab_entry_detected', appendLog);
    await persistNavigationDebug?.(dbg);
  }

  await onFsmPhase?.('opening_iflight');
  await clickSabCrewHeaderContext(page, appendLog);

  let workPage: Page = page;
  let root: LocatorRoot = page;
  try {
    const opened = await openIFlightNeoWithFallbacks(context, page, appendLog, failDir);
    workPage = opened.workPage;
    root = opened.root;
    await appendLog({
      step: 'iflight_resolved',
      resolution: opened.resolution,
      workUrl: workPage.url(),
      step_tag: 'iflight_entry_detected',
    });
    if (instrument) {
      const dbg = await instrument.buildTechnicalSnapshot(workPage, 'iflight_entry_detected', appendLog);
      await persistNavigationDebug?.(dbg);
    }
  } catch (e) {
    if (instrument) await instrument.emitStuckEvidence(page, failDir, 'iflight-open', appendLog);
    await artifact(page, failDir, 'iflight-open', appendLog);
    throw e;
  }

  try {
    await onFsmPhase?.('locating_roster');
    await waitForRosterShell(root, appendLog);
    await appendLog({ step: 'roster_report_candidate', ok: true, note: 'shell_text_matched' });
    if (instrument) {
      const dbg = await instrument.buildTechnicalSnapshot(workPage, 'roster_area_ready', appendLog);
      await persistNavigationDebug?.(dbg);
    }
  } catch (e) {
    if (instrument) await instrument.emitStuckEvidence(workPage, failDir, 'roster-screen', appendLog);
    await artifact(workPage, failDir, 'roster-screen', appendLog);
    throw e;
  }

  try {
    await onFsmPhase?.('downloading_report');
    const { buffer, suggestedName } = await capturePdfDownloadOrResponse(
      workPage,
      root,
      appendLog,
      failDir,
      instrument,
    );
    return { buffer, fileName: suggestedName };
  } catch (e) {
    if (instrument) await instrument.emitStuckEvidence(workPage, failDir, 'crewroster-download', appendLog);
    await artifact(workPage, failDir, 'crewroster-download', appendLog);
    throw e;
  }
}
