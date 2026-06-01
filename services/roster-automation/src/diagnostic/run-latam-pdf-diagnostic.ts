/**
 * Diagnóstico local: SSO → AIMS/eCrew → RosterReport.aspx (?type=HTML prioritário, depois PDF).
 * Evidências em disco (screenshots, step_lines.ndjson, HTML/PDF, report.json).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { config } from '../config.js';
import { log } from '../logger.js';
import { waitForAuthenticationAfterSso } from '../providers/latam/navigation.js';
import { detectCorporateSurface } from '../providers/latam/surface-detector.js';
import { createEmptyEcrewProbe, runEcrewRosterCaptureSequence } from '../providers/latam/ecrew-roster-flow.js';
import { attachEcrewPriorityNetwork, type EcrewNetworkEntry } from '../providers/latam/ecrew-network.js';
import { ensureDir, screenshotStep, stamp } from './diagnostic-artifacts.js';
import {
  attachConsoleBlobHints,
  attachContextPageTracking,
  attachDiagnosticNetwork,
  attachPopupTracking,
} from './diagnostic-network-and-pages.js';
import { mapEcrewProbeToConclusion } from './map-ecrew-diagnostic-conclusion.js';
import type {
  LatamPdfDiagnosticReport,
  TrailEntry,
  NetworkHighlight,
  PdfCandidate,
  PageEventEntry,
} from './latam-pdf-diagnostic-types.js';

const SCOPE = 'latam-pdf-diagnostic';

async function pushTrail(trail: TrailEntry[], phase: string, page: Page, note?: string): Promise<void> {
  const url = page.url();
  let title = '';
  try {
    title = await page.title();
  } catch {
    title = '';
  }
  let host = '';
  let pathname = '';
  try {
    const u = new URL(url);
    host = u.hostname;
    pathname = u.pathname;
  } catch {
    /* empty */
  }
  trail.push({
    at: new Date().toISOString(),
    phase,
    url: url.slice(0, 2_000),
    title: title.slice(0, 400),
    host,
    path: pathname.slice(0, 600),
    note,
  });
  log(SCOPE, 'info', 'trail', { phase, url: url.slice(0, 200), note });
}

function createAppendLog(
  networkHighlights: NetworkHighlight[],
  pdfCandidates: PdfCandidate[],
  lines: string[],
): (e: Record<string, unknown>) => Promise<void> {
  return async (e) => {
    const line = JSON.stringify({ at: new Date().toISOString(), ...e });
    lines.push(line);
    if (typeof e.step === 'string' && /pdf|download|response_pdf|ecrew_roster/i.test(JSON.stringify(e))) {
      pdfCandidates.push({
        at: new Date().toISOString(),
        kind: 'response_pdf',
        detail: line.slice(0, 1_500),
      });
    }
  };
}

export async function runLatamPdfDiagnostic(): Promise<LatamPdfDiagnosticReport> {
  const startedAt = new Date().toISOString();
  const baseOut = path.join(config.dataDir(), 'diagnostics', `latam-ecrew-${stamp()}`);
  await ensureDir(baseOut);

  const trail: TrailEntry[] = [];
  const pageEvents: PageEventEntry[] = [];
  const networkHighlights: NetworkHighlight[] = [];
  const pdfCandidates: PdfCandidate[] = [];
  const ecrewNetworkLog: EcrewNetworkEntry[] = [];
  const screenshots: string[] = [];
  const logLines: string[] = [];

  const appendLog = createAppendLog(networkHighlights, pdfCandidates, logLines);

  let lastPhase = 'init';
  let error: string | undefined;
  const emptyProbe = createEmptyEcrewProbe();

  const loginUrl = config.latamPortalLoginUrl();
  if (!loginUrl) {
    const conclusionDetail = 'LATAM_PORTAL_LOGIN_URL ausente no .env';
    return buildReport(startedAt, baseOut, 'error', conclusionDetail, 'init', {
      trail,
      pageEvents,
      networkHighlights,
      pdfCandidates,
      screenshots,
      ecrewProbe: emptyProbe,
      ecrewNetworkLog,
      error: conclusionDetail,
    });
  }

  const profileDir = path.join(config.dataDir(), 'diagnostic-browser-profile');
  await ensureDir(profileDir);

  let context: BrowserContext | null = null;
  const unsubs: Array<() => void> = [];

  try {
    context = await chromium.launchPersistentContext(profileDir, {
      headless: config.headless(),
      viewport: { width: 1400, height: 900 },
      locale: 'pt-BR',
      acceptDownloads: true,
    });

    unsubs.push(attachContextPageTracking(context, pageEvents));
    unsubs.push(attachEcrewPriorityNetwork(context, ecrewNetworkLog));

    const page = context.pages()[0] ?? (await context.newPage());
    page.setDefaultTimeout(120_000);

    unsubs.push(attachDiagnosticNetwork(page, networkHighlights, pdfCandidates));
    unsubs.push(attachPopupTracking(page, pageEvents));
    attachConsoleBlobHints(page, pdfCandidates);

    for (const p of context.pages()) {
      unsubs.push(attachDiagnosticNetwork(p, networkHighlights, pdfCandidates));
      p.on('download', (d) => {
        pdfCandidates.push({
          at: new Date().toISOString(),
          kind: 'download_suggested',
          detail: `suggested=${d.suggestedFilename()} url=${d.url?.()?.slice(0, 400) ?? 'n/a'}`,
        });
      });
    }

    const onContextPage = (newPage: Page) => {
      unsubs.push(attachDiagnosticNetwork(newPage, networkHighlights, pdfCandidates));
      newPage.on('download', (d) => {
        pdfCandidates.push({
          at: new Date().toISOString(),
          kind: 'download_suggested',
          detail: `page=${newPage.url().slice(0, 200)} file=${d.suggestedFilename()}`,
        });
      });
    };
    context.on('page', onContextPage);
    unsubs.push(() => context!.off('page', onContextPage));

    lastPhase = 'goto_login';
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await pushTrail(trail, 'after_goto_login', page);
    await screenshotStep(page, baseOut, '01_login_loaded', screenshots);

    lastPhase = 'wait_sso_auth';
    const authed = await waitForAuthenticationAfterSso(page, context, {
      deadlineMs: 25 * 60_000,
      waitForUrlTimeoutMs: 120_000,
      appendLog: async (e) => {
        logLines.push(JSON.stringify(e));
      },
    });

    if (!authed) {
      lastPhase = 'auth_timeout';
      await screenshotStep(page, baseOut, '02_auth_timeout', screenshots);
      await writeTextLog(baseOut, logLines);
      const mapped = mapEcrewProbeToConclusion(emptyProbe, false);
      return buildReport(startedAt, baseOut, mapped.conclusion, mapped.conclusionDetail, lastPhase, {
        trail,
        pageEvents,
        networkHighlights,
        pdfCandidates,
        screenshots,
        ecrewProbe: emptyProbe,
        ecrewNetworkLog,
        error: mapped.conclusionDetail,
      });
    }

    await pushTrail(trail, 'authenticated', page);
    await screenshotStep(page, baseOut, '03_authenticated', screenshots);

    const surf = await detectCorporateSurface(page);
    logLines.push(JSON.stringify({ step: 'surface_after_auth', surface: surf.surface, url: surf.url }));

    lastPhase = 'ecrew_flow';
    const ecredEntry = config.latamEcredEntryUrl();
    if (ecredEntry) {
      logLines.push(JSON.stringify({ step: 'ecrew_config', LATAM_ECREW_ENTRY_URL: ecredEntry.slice(0, 400) }));
    }

    const ecrewProbe = await runEcrewRosterCaptureSequence(page, context, baseOut, {
      ecredEntryUrl: ecredEntry || undefined,
      appendLog,
    });

    logLines.push(JSON.stringify({ step: 'ecrew_probe_final', ...serializeProbeForLog(ecrewProbe) }));

    await pushTrail(trail, 'ecrew_capture_done', page, ecrewProbe.ecrewBaseUrl ?? undefined);
    await screenshotStep(page, baseOut, '04_ecrew_flow_end', screenshots);

    const mapped = mapEcrewProbeToConclusion(ecrewProbe, true);

    await writeTextLog(baseOut, logLines);
    return buildReport(startedAt, baseOut, mapped.conclusion, mapped.conclusionDetail, lastPhase, {
      trail,
      pageEvents,
      networkHighlights,
      pdfCandidates,
      screenshots,
      ecrewProbe,
      ecrewNetworkLog,
      error,
    });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    await writeTextLog(baseOut, logLines);
    return buildReport(startedAt, baseOut, 'error', error, lastPhase, {
      trail,
      pageEvents,
      networkHighlights,
      pdfCandidates,
      screenshots,
      ecrewProbe: emptyProbe,
      ecrewNetworkLog,
      error,
    });
  } finally {
    for (const u of unsubs) {
      try {
        u();
      } catch {
        /* ignore */
      }
    }
    await context?.close();
  }
}

function serializeProbeForLog(p: import('../providers/latam/ecrew-roster-flow.js').EcrewRosterProbe): Record<string, unknown> {
  return {
    reachedEcrew: p.reachedEcrew,
    ecrewBaseUrl: p.ecrewBaseUrl,
    myScheduleFound: p.myScheduleFound,
    myScheduleOpened: p.myScheduleOpened,
    printFound: p.printFound,
    printClicked: p.printClicked,
    rosterReportAspxSeen: p.rosterReportAspxSeen,
    typeHtmlSeen: p.typeHtmlSeen,
    typePdfSeen: p.typePdfSeen,
    htmlSavedPath: p.htmlSavedPath,
    pdfSavedPath: p.pdfSavedPath,
    failedAt: p.failedAt,
    lastError: p.lastError,
  };
}

async function writeTextLog(baseOut: string, lines: string[]): Promise<void> {
  await fs.writeFile(path.join(baseOut, 'step_lines.ndjson'), lines.join('\n'), 'utf8');
}

function buildReport(
  startedAt: string,
  outputDir: string,
  conclusion: LatamPdfDiagnosticReport['conclusion'],
  conclusionDetail: string,
  lastPhase: string,
  parts: Omit<
    LatamPdfDiagnosticReport,
    'startedAt' | 'finishedAt' | 'outputDir' | 'conclusion' | 'conclusionDetail' | 'lastPhase'
  > & { error?: string },
): LatamPdfDiagnosticReport {
  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    outputDir,
    conclusion,
    conclusionDetail,
    lastPhase,
    ...parts,
  };
}

export async function writeDiagnosticReportJson(report: LatamPdfDiagnosticReport): Promise<string> {
  const p = path.join(report.outputDir, 'report.json');
  await fs.writeFile(p, JSON.stringify(report, null, 2), 'utf8');
  return p;
}
