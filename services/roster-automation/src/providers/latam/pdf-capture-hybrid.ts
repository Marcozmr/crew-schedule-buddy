/**
 * Captura do CrewRosterReport: prioridade download Playwright > response PDF > evidência em falha.
 */
import path from 'node:path';
import type { Download, Page, Response } from 'playwright';
import type { LocatorRoot } from './latam-shared-dom.js';
import { pickDownloadTimeoutMs, triggerCrewRosterDownload } from './navigation.js';
import type { PostLoginNavigationInstrument } from './post-login-navigation-instrumentation.js';

export type PipelineLogFn = (entry: Record<string, unknown>) => Promise<void>;

function filenameFromUrl(u: string): string {
  try {
    const last = new URL(u).pathname.split('/').pop() || 'report.pdf';
    return last.includes('.') ? last : `CrewRosterReport-${Date.now()}.pdf`;
  } catch {
    return `CrewRosterReport-${Date.now()}.pdf`;
  }
}

function responseLooksLikePdf(res: Response): boolean {
  if (!res.ok()) return false;
  const ct = (res.headers()['content-type'] || '').toLowerCase();
  if (ct.includes('application/pdf')) return true;
  return /\.pdf(\?|#|$)/i.test(res.url());
}

type RaceOk =
  | { kind: 'download'; d: Download }
  | { kind: 'response'; r: Response }
  | null;

/**
 * Prioridade 1–2: listeners antes do clique; corrida download vs response PDF.
 */
export async function capturePdfDownloadOrResponse(
  workPage: Page,
  root: LocatorRoot,
  appendLog: PipelineLogFn,
  failDir: string,
  instrument: PostLoginNavigationInstrument | undefined,
): Promise<{ buffer: Buffer; suggestedName: string; source: 'download' | 'response' }> {
  const timeout = pickDownloadTimeoutMs();

  const downloadPromise: Promise<RaceOk> = workPage
    .waitForEvent('download', { timeout })
    .then((d) => ({ kind: 'download' as const, d }))
    .catch(() => null);

  const responsePromise: Promise<RaceOk> = workPage
    .waitForResponse((res) => responseLooksLikePdf(res), { timeout })
    .then((r) => ({ kind: 'response' as const, r }))
    .catch(() => null);

  await appendLog({ step: 'pdf_capture_race', phase: 'listeners_registered', timeoutMs: timeout });

  const clicked = await triggerCrewRosterDownload(root);
  if (!clicked) {
    await appendLog({ step: 'crewroster_click', ok: false });
    throw new Error('Não foi possível acionar CrewRosterReport / exportar PDF');
  }
  await appendLog({ step: 'crewroster_click', ok: true });

  const winner = await Promise.race([downloadPromise, responsePromise]);

  async function tryDownload(d: Download): Promise<{ buffer: Buffer; suggestedName: string }> {
    await appendLog({
      step: 'download_completed',
      suggestedFilename: d.suggestedFilename(),
    });
    const p = await d.path();
    if (!p) throw new Error('Download sem caminho temporário');
    const fs = await import('node:fs/promises');
    const buffer = await fs.readFile(p);
    let suggestedName = d.suggestedFilename() || `CrewRosterReport-${Date.now()}.pdf`;
    try {
      const u = d.url();
      if (u && !suggestedName.endsWith('.pdf')) suggestedName = filenameFromUrl(u);
    } catch {
      /* ignore */
    }
    await appendLog({ step: 'pdf_download', ok: true, bytes: buffer.length, suggestedName, source: 'download' });
    return { buffer, suggestedName };
  }

  async function tryResponse(r: Response): Promise<{ buffer: Buffer; suggestedName: string }> {
    await appendLog({
      step: 'response_pdf_candidate',
      url: r.url().slice(0, 1_500),
      status: r.status(),
    });
    const body = await r.body();
    const buffer = Buffer.from(body);
    const suggestedName = filenameFromUrl(r.url());
    await appendLog({ step: 'pdf_download', ok: true, bytes: buffer.length, suggestedName, source: 'response' });
    return { buffer, suggestedName };
  }

  if (winner?.kind === 'download') {
    const { buffer, suggestedName } = await tryDownload(winner.d);
    return { buffer, suggestedName, source: 'download' };
  }
  if (winner?.kind === 'response') {
    const { buffer, suggestedName } = await tryResponse(winner.r);
    return { buffer, suggestedName, source: 'response' };
  }

  const dlLate = await downloadPromise;
  if (dlLate?.kind === 'download') {
    await appendLog({ step: 'download_completed', note: 'late_resolve' });
    const { buffer, suggestedName } = await tryDownload(dlLate.d);
    return { buffer, suggestedName, source: 'download' };
  }

  const respLate = await responsePromise;
  if (respLate?.kind === 'response') {
    await appendLog({ step: 'response_pdf_candidate', note: 'late_resolve' });
    const { buffer, suggestedName } = await tryResponse(respLate.r);
    return { buffer, suggestedName, source: 'response' };
  }

  /** Prioridade 3: repetir GET ao último candidato GET com status 200 (mesma sessão). */
  const apiResult = await tryAuthenticatedPdfGet(workPage, appendLog);
  if (apiResult) {
    return apiResult;
  }

  if (instrument) {
    await instrument.emitStuckEvidence(workPage, failDir, 'pdf-race-miss', appendLog);
  }

  throw new Error(
    'Nem download nem response PDF — ver step_logs: request_report_candidate, response_report_candidate, navigation_technical_snapshot',
  );
}

async function tryAuthenticatedPdfGet(
  workPage: Page,
  appendLog: PipelineLogFn,
): Promise<{ buffer: Buffer; suggestedName: string; source: 'response' } | null> {
  const ctx = workPage.context();
  const candidates = await workPage.evaluate(() => {
    const out: string[] = [];
    for (const a of Array.from(document.querySelectorAll('a[href*="pdf"], a[href*="report"], a[href*="Roster"]'))) {
      const href = (a as HTMLAnchorElement).href;
      if (href && /^https?:/i.test(href)) out.push(href);
    }
    return out.slice(0, 5);
  });
  for (const url of candidates) {
    try {
      await appendLog({ step: 'pdf_api_try', url: url.slice(0, 800), method: 'GET' });
      const res = await ctx.request.get(url, { timeout: 60_000, failOnStatusCode: false });
      const ct = (res.headers()['content-type'] || '').toLowerCase();
      if (res.ok() && ct.includes('application/pdf')) {
        const buffer = Buffer.from(await res.body());
        await appendLog({ step: 'pdf_api_ok', bytes: buffer.length, url: url.slice(0, 500) });
        return { buffer, suggestedName: filenameFromUrl(url), source: 'response' };
      }
    } catch {
      /* next */
    }
  }
  return null;
}
