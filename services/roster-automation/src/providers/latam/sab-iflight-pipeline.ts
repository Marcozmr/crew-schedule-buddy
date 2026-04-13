/**
 * SAB → contexto tripulante → iFlightNeo (com fallbacks) → escala → CrewRosterReport (PDF).
 */
import path from 'node:path';
import type { BrowserContext, Download, Frame, Page } from 'playwright';
import { log } from '../../logger.js';
import { saveFailureArtifacts } from '../../artifacts.js';
import { withRetries } from '../../retry.js';
import { pickDownloadTimeoutMs, triggerCrewRosterDownload, waitForSabPortalSurface } from './navigation.js';
import { clickSabCrewHeaderContext } from './sab-crew-header.js';
import { openIFlightNeoWithFallbacks } from './iflight-launcher.js';
import type { LocatorRoot } from './latam-shared-dom.js';

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

export async function downloadCrewRosterPdfFromRoot(
  workPage: Page,
  root: LocatorRoot,
  appendLog: PipelineLogFn,
): Promise<{ buffer: Buffer; suggestedName: string; download: Download }> {
  const dlTimeout = pickDownloadTimeoutMs();
  const downloadPromise = workPage.waitForEvent('download', { timeout: dlTimeout });

  const clicked = await triggerCrewRosterDownload(root);
  if (!clicked) {
    await appendLog({ step: 'crewroster_click', ok: false });
    throw new Error('Não foi possível acionar CrewRosterReport / exportar PDF');
  }

  await appendLog({ step: 'crewroster_click', ok: true });

  let download: Download;
  try {
    download = await downloadPromise;
  } catch (e) {
    await appendLog({
      step: 'download_wait',
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    });
    throw new Error('Nenhum download iniciado após o clique — verifique menu/exportação no iFlight');
  }

  const p = await download.path();
  if (!p) throw new Error('Download sem caminho temporário');
  const fs = await import('node:fs/promises');
  const buffer = await fs.readFile(p);
  const suggestedName = download.suggestedFilename() || `CrewRosterReport-${Date.now()}.pdf`;
  await appendLog({ step: 'pdf_download', ok: true, bytes: buffer.length, suggestedName });
  return { buffer, suggestedName, download };
}

export type SabPipelineResult = { buffer: Buffer; fileName: string };

export async function runSabToCrewRosterPdf(params: {
  context: BrowserContext;
  page: Page;
  userId: string;
  runId: string;
  failDir: string;
  appendLog: PipelineLogFn;
}): Promise<SabPipelineResult> {
  const { context, page, runId, failDir, appendLog } = params;

  await appendLog({ step: 'pipeline_start', runId, phase: 'sab_iflight_crewroster' });

  await withRetries('wait_sab', 5, 3_000, async () => {
    const ok = await waitForSabPortalSurface(page);
    if (!ok) throw new Error('SAB / tile iFlightNeo ainda não visível');
  });
  await appendLog({ step: 'sab_surface', ok: true, url: page.url() });

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
    });
  } catch (e) {
    await artifact(page, failDir, 'iflight-open', appendLog);
    throw e;
  }

  try {
    await waitForRosterShell(root, appendLog);
  } catch (e) {
    await artifact(workPage, failDir, 'roster-screen', appendLog);
    throw e;
  }

  try {
    const { buffer, suggestedName } = await downloadCrewRosterPdfFromRoot(workPage, root, appendLog);
    return { buffer, fileName: suggestedName };
  } catch (e) {
    await artifact(workPage, failDir, 'crewroster-download', appendLog);
    throw e;
  }
}
