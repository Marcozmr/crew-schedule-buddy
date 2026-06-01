/**
 * Fluxo explícito AIMS/eCrew: alcançar /ecrew/ → (opcional) My Schedule → Print → RosterReport.aspx (HTML antes de PDF).
 * Prioridade: pedidos autenticados às rotas Reports; fallback UI.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { BrowserContext, Frame, Page, Response } from 'playwright';
import { clickFirstMatching } from './navigation.js';

export type PipelineLogFn = (entry: Record<string, unknown>) => Promise<void>;

function fileStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23);
}

/** Base URL do módulo eCrew (termina em /ecrew, sem slash final obrigatória). */
export function extractEcrewBaseUrl(pageUrl: string): string | null {
  try {
    const u = new URL(pageUrl);
    const lower = u.pathname.toLowerCase();
    const idx = lower.indexOf('/ecrew');
    if (idx < 0) return null;
    const basePath = u.pathname.slice(0, idx + '/ecrew'.length);
    return `${u.origin}${basePath}`;
  } catch {
    return null;
  }
}

export function buildRosterReportUrls(ecrewBase: string): { html: string; pdf: string } {
  const b = ecrewBase.replace(/\/$/, '');
  return {
    html: `${b}/Reports/RosterReport.aspx?type=HTML`,
    pdf: `${b}/Reports/RosterReport.aspx?type=PDF`,
  };
}

export function urlSignalsRosterReport(url: string): { rosterReport: boolean; typeHtml: boolean; typePdf: boolean } {
  const u = url.toLowerCase();
  return {
    rosterReport: /RosterReport\.aspx/i.test(url),
    typeHtml: /[?&]type\s*=\s*html/i.test(u) || /type%3dhtml/i.test(u),
    typePdf: /[?&]type\s*=\s*pdf/i.test(u) || /type%3dpdf/i.test(u),
  };
}

export type EcrewFailurePoint =
  | 'reach_ecrew'
  | 'my_schedule'
  | 'print'
  | 'export_or_save'
  | 'direct_fetch'
  | null;

export interface EcrewRosterProbe {
  reachedEcrew: boolean;
  ecrewBaseUrl: string | null;
  myScheduleFound: boolean;
  myScheduleOpened: boolean;
  printFound: boolean;
  printClicked: boolean;
  rosterReportAspxSeen: boolean;
  typeHtmlSeen: boolean;
  typePdfSeen: boolean;
  htmlSavedPath: string | null;
  pdfSavedPath: string | null;
  failedAt: EcrewFailurePoint;
  lastError: string | null;
}

export function createEmptyEcrewProbe(): EcrewRosterProbe {
  return {
    reachedEcrew: false,
    ecrewBaseUrl: null,
    myScheduleFound: false,
    myScheduleOpened: false,
    printFound: false,
    printClicked: false,
    rosterReportAspxSeen: false,
    typeHtmlSeen: false,
    typePdfSeen: false,
    htmlSavedPath: null,
    pdfSavedPath: null,
    failedAt: null,
    lastError: null,
  };
}

const MY_SCHEDULE_RES = [/My\s*Schedule/i, /Minha\s+[Ee]scala/i, /My\s+Roster/i];
const PRINT_RES = [/Print/i, /Imprimir/i];
const EXPORT_RES = [/Export\s*To/i, /Exportar/i];

async function clickInPageOrFrames(page: Page, clickFn: (root: Page | Frame) => Promise<boolean>): Promise<boolean> {
  if (await clickFn(page)) return true;
  for (const f of page.frames()) {
    if (f === page.mainFrame()) continue;
    try {
      if (await clickFn(f)) return true;
    } catch {
      /* next frame */
    }
  }
  return false;
}

async function discoverEcrewHref(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const sel = 'a[href*="ecrew" i], a[href*="eCrew"], a[href*="ECREW"]';
    const as = Array.from(document.querySelectorAll<HTMLAnchorElement>(sel));
    for (const a of as) {
      const h = a.getAttribute('href');
      if (!h) continue;
      try {
        const abs = new URL(h, window.location.href).href;
        if (/ecrew/i.test(abs)) return abs;
      } catch {
        /* next */
      }
    }
    return null;
  });
}

/**
 * Alcança uma página cuja URL contém /ecrew/ (entrada explícita, link no portal ou já autenticado).
 */
export async function reachEcrewModule(
  page: Page,
  opts: { ecredEntryUrl?: string; appendLog: PipelineLogFn; timeoutMs?: number },
): Promise<{ ok: boolean; baseUrl: string | null; detail: string }> {
  const { ecredEntryUrl, appendLog, timeoutMs = 120_000 } = opts;
  const started = Date.now();

  let base = extractEcrewBaseUrl(page.url());
  if (base) {
    await appendLog({ step: 'ecrew_reach', phase: 'already_on_ecrew', url: page.url(), baseUrl: base });
    return { ok: true, baseUrl: base, detail: 'already_on_ecrew' };
  }

  if (ecredEntryUrl) {
    await appendLog({ step: 'ecrew_reach', phase: 'goto_entry_url', url: ecredEntryUrl });
    await page.goto(ecredEntryUrl, { waitUntil: 'domcontentloaded', timeout: Math.min(timeoutMs, 120_000) });
    await page.waitForTimeout(2_000);
    base = extractEcrewBaseUrl(page.url());
    if (base) {
      await appendLog({ step: 'ecrew_reach', phase: 'after_goto_entry', baseUrl: base });
      return { ok: true, baseUrl: base, detail: 'via_LATAM_ECREW_ENTRY_URL' };
    }
  }

  while (Date.now() - started < timeoutMs) {
    const href = await discoverEcrewHref(page).catch(() => null);
    if (href) {
      await appendLog({ step: 'ecrew_reach', phase: 'follow_discovered_link', href: href.slice(0, 500) });
      await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await page.waitForTimeout(2_000);
      base = extractEcrewBaseUrl(page.url());
      if (base) {
        await appendLog({ step: 'ecrew_reach', phase: 'after_link', baseUrl: base });
        return { ok: true, baseUrl: base, detail: 'via_portal_link' };
      }
    }

    const clicked = await clickInPageOrFrames(page, async (root) =>
      clickFirstMatching(root, [/eCrew/i, /AIMS/i, /My\s+eCrew/i], 'link'),
    );
    if (clicked) {
      await page.waitForTimeout(3_000);
      base = extractEcrewBaseUrl(page.url());
      if (base) {
        await appendLog({ step: 'ecrew_reach', phase: 'after_tile_click', baseUrl: base });
        return { ok: true, baseUrl: base, detail: 'via_named_link' };
      }
    }

    await page.waitForTimeout(2_500);
  }

  await appendLog({ step: 'ecrew_reach', ok: false, url: page.url() });
  return { ok: false, baseUrl: null, detail: 'timeout_no_ecrew_url' };
}

/**
 * Captura HTML e PDF via APIRequest do Playwright (cookies da sessão do browser).
 */
export async function tryFetchRosterReportArtifacts(
  page: Page,
  ecrewBase: string,
  outDir: string,
  probe: EcrewRosterProbe,
  appendLog: PipelineLogFn,
): Promise<void> {
  const { html, pdf } = buildRosterReportUrls(ecrewBase);
  const api = page.context().request;

  await appendLog({ step: 'ecrew_direct_fetch', htmlUrl: html.slice(0, 400), pdfUrl: pdf.slice(0, 400) });

  try {
    probe.typeHtmlSeen = true;
    const r = await api.get(html, { timeout: 90_000, failOnStatusCode: false });
    const ct = (r.headers()['content-type'] || '').toLowerCase();
    const body = Buffer.from(await r.body());
    probe.rosterReportAspxSeen = probe.rosterReportAspxSeen || r.status() < 500;
    await appendLog({
      step: 'ecrew_roster_html_fetch',
      status: r.status(),
      contentType: ct.slice(0, 120),
      bytes: body.length,
    });
    if (r.ok() && body.length > 50 && (ct.includes('html') || ct.includes('text/plain') || body.toString('utf8', 0, Math.min(200, body.length)).includes('<'))) {
      const p = path.join(outDir, `RosterReport-${fileStamp()}.html`);
      await fs.writeFile(p, body);
      probe.htmlSavedPath = p;
    }
  } catch (e) {
    probe.lastError = e instanceof Error ? e.message : String(e);
    await appendLog({ step: 'ecrew_roster_html_fetch_error', message: probe.lastError });
  }

  try {
    const r = await api.get(pdf, { timeout: 90_000, failOnStatusCode: false });
    const ct = (r.headers()['content-type'] || '').toLowerCase();
    const body = Buffer.from(await r.body());
    probe.typePdfSeen = true;
    await appendLog({
      step: 'ecrew_roster_pdf_fetch',
      status: r.status(),
      contentType: ct.slice(0, 120),
      bytes: body.length,
    });
    const looksPdf = ct.includes('pdf') || body.slice(0, 4).toString('ascii') === '%PDF';
    if (r.ok() && looksPdf && body.length > 100) {
      const p = path.join(outDir, `RosterReport-${fileStamp()}.pdf`);
      await fs.writeFile(p, body);
      probe.pdfSavedPath = p;
    }
  } catch (e) {
    probe.lastError = e instanceof Error ? e.message : String(e);
    await appendLog({ step: 'ecrew_roster_pdf_fetch_error', message: probe.lastError });
  }
}

function attachRosterReportResponseProbe(page: Page, probe: EcrewRosterProbe): () => void {
  const onResp = (res: Response) => {
    const url = res.url();
    const sig = urlSignalsRosterReport(url);
    if (sig.rosterReport) probe.rosterReportAspxSeen = true;
    if (sig.typeHtml) probe.typeHtmlSeen = true;
    if (sig.typePdf) probe.typePdfSeen = true;
  };
  page.on('response', onResp);
  return () => page.off('response', onResp);
}

/**
 * Fallback UI: My Schedule → Print (e opcionalmente Export To). Observa respostas RosterReport na rede.
 */
export async function tryUiMyScheduleThenPrint(
  page: Page,
  context: BrowserContext,
  probe: EcrewRosterProbe,
  outDir: string,
  appendLog: PipelineLogFn,
): Promise<void> {
  const detach = attachRosterReportResponseProbe(page, probe);
  const unsubs: Array<() => void> = [detach];
  for (const p of context.pages()) {
    unsubs.push(attachRosterReportResponseProbe(p, probe));
  }
  const onNew = (p: Page) => unsubs.push(attachRosterReportResponseProbe(p, probe));
  context.on('page', onNew);

  try {
    const bodySample = await page.locator('body').innerText({ timeout: 8_000 }).catch(() => '');
    const alreadySchedule = /my\s*schedule|minha\s*escala|pairing|duty\s*period/i.test(bodySample);
    if (alreadySchedule) {
      probe.myScheduleFound = true;
      probe.myScheduleOpened = true;
      await appendLog({ step: 'ecrew_my_schedule', phase: 'already_on_schedule_surface' });
    } else {
      const opened = await clickInPageOrFrames(page, async (root) => {
        const ok = await clickFirstMatching(root, MY_SCHEDULE_RES, 'link');
        return ok || (await clickFirstMatching(root, MY_SCHEDULE_RES, 'button'));
      });
      probe.myScheduleFound = opened;
      probe.myScheduleOpened = opened;
      await appendLog({ step: 'ecrew_my_schedule', clicked: opened });
      if (opened) await page.waitForTimeout(3_000);
    }

    if (!probe.myScheduleOpened && !alreadySchedule) {
      probe.failedAt = 'my_schedule';
      return;
    }

    const printClicked = await clickInPageOrFrames(page, async (root) =>
      clickFirstMatching(root, PRINT_RES, 'button'),
    );
    probe.printFound = printClicked;
    probe.printClicked = printClicked;
    await appendLog({ step: 'ecrew_print', clicked: printClicked });

    if (!printClicked) {
      const exportClicked = await clickInPageOrFrames(page, async (root) =>
        clickFirstMatching(root, EXPORT_RES, 'button'),
      );
      await appendLog({ step: 'ecrew_export_to', clicked: exportClicked });
      if (exportClicked) {
        await page.waitForTimeout(1_500);
        probe.printClicked =
          (await clickInPageOrFrames(page, async (root) =>
            clickFirstMatching(root, PRINT_RES, 'button'),
          )) || probe.printClicked;
        probe.printFound = probe.printClicked;
      }
    }

    if (!probe.printClicked) {
      probe.failedAt = 'print';
      return;
    }

    await appendLog({ step: 'ecrew_wait_export', phase: 'post_print_wait' });
    await page.waitForTimeout(5_000);

    const pages = context.pages();
    for (const p of pages) {
      const u = p.url();
      if (/RosterReport\.aspx/i.test(u)) {
        probe.rosterReportAspxSeen = true;
        const sig = urlSignalsRosterReport(u);
        if (sig.typeHtml) probe.typeHtmlSeen = true;
        if (sig.typePdf) probe.typePdfSeen = true;
        try {
          if (/type=HTML/i.test(u) || /type%3dhtml/i.test(u.toLowerCase())) {
            const html = await p.content();
            if (html.length > 100 && !probe.htmlSavedPath) {
              const fp = path.join(outDir, `RosterReport-ui-${fileStamp()}.html`);
              await fs.writeFile(fp, html, 'utf8');
              probe.htmlSavedPath = fp;
            }
          }
        } catch {
          /* ignore */
        }
      }
    }
  } finally {
    context.off('page', onNew);
    for (const u of unsubs) {
      try {
        u();
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Orquestra: alcançar eCrew → GET direto HTML/PDF → fallback My Schedule / Print.
 */
export async function runEcrewRosterCaptureSequence(
  page: Page,
  context: BrowserContext,
  outDir: string,
  opts: { ecredEntryUrl?: string; appendLog: PipelineLogFn },
): Promise<EcrewRosterProbe> {
  const probe = createEmptyEcrewProbe();
  const reach = await reachEcrewModule(page, {
    ecredEntryUrl: opts.ecredEntryUrl,
    appendLog: opts.appendLog,
  });
  if (!reach.ok || !reach.baseUrl) {
    probe.failedAt = 'reach_ecrew';
    probe.lastError = reach.detail;
    return probe;
  }
  probe.reachedEcrew = true;
  probe.ecrewBaseUrl = reach.baseUrl;

  await tryFetchRosterReportArtifacts(page, reach.baseUrl, outDir, probe, opts.appendLog);

  if (probe.htmlSavedPath && probe.pdfSavedPath) {
    return probe;
  }

  await tryUiMyScheduleThenPrint(page, context, probe, outDir, opts.appendLog);

  if (probe.htmlSavedPath || probe.pdfSavedPath) {
    probe.failedAt = null;
  } else if (!probe.failedAt) {
    probe.failedAt = 'export_or_save';
  }

  return probe;
}
