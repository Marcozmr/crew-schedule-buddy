/**
 * Abertura do iFlight com diagnóstico (href, redirects, 403 Google SAML) e fallbacks no SAB.
 */
import type { BrowserContext, Frame, Locator, Page } from 'playwright';
import { saveFailureArtifacts } from '../../artifacts.js';
import { log } from '../../logger.js';
import { findIFlightNeoTile, pickIFlightFrame, pickRosterRoot, type LocatorRoot } from './latam-shared-dom.js';

const SCOPE = 'iflight-launcher';

export type PipelineLogFn = (entry: Record<string, unknown>) => Promise<void>;

export type NavTelemetry = { type: string; url: string; status?: number; at: string };

export function isGoogleSamlForbidden(url: string, bodySnippet: string): boolean {
  if (/accounts\.google\.com|googleusercontent|Google\s*Apps/i.test(url)) {
    if (/403|app_not_configured|not configured|Access blocked|app_not_configured_for_user/i.test(bodySnippet))
      return true;
  }
  return /app_not_configured_for_user|app_not_configured/i.test(bodySnippet);
}

export function attachPageTelemetry(page: Page, events: NavTelemetry[]): () => void {
  const onResponse = (res: import('playwright').Response) => {
    const url = res.url();
    const status = res.status();
    if (
      status >= 400 ||
      /google\.com|accounts\.google|saml|oauth|openid/i.test(url) ||
      /iflight|neo|latam|sab/i.test(url)
    ) {
      events.push({ type: 'response', url, status, at: new Date().toISOString() });
    }
  };
  const onRequest = (req: import('playwright').Request) => {
    if (req.isNavigationRequest()) {
      events.push({ type: 'navigation_request', url: req.url(), at: new Date().toISOString() });
    }
  };
  const onFrameNav = (frame: Frame) => {
    if (frame === page.mainFrame()) {
      events.push({ type: 'main_frame_nav', url: frame.url(), at: new Date().toISOString() });
    }
  };
  page.on('response', onResponse);
  page.on('request', onRequest);
  page.on('framenavigated', onFrameNav);
  return () => {
    page.off('response', onResponse);
    page.off('request', onRequest);
    page.off('framenavigated', onFrameNav);
  };
}

export async function extractTileDiagnostics(tile: Locator): Promise<{
  outerHtml: string;
  href: string | null;
  tagName: string | null;
}> {
  return tile.evaluate((el) => {
    const a = el.closest('a');
    const html = (el as HTMLElement).outerHTML?.slice(0, 800) ?? '';
    return {
      outerHtml: html,
      href: a?.href ?? (el as HTMLAnchorElement).href ?? null,
      tagName: el.tagName ?? null,
    };
  });
}

async function pageLooksLikeGoogle403(p: Page): Promise<boolean> {
  const url = p.url();
  const body = await p.locator('body').innerText({ timeout: 12_000 }).catch(() => '');
  return isGoogleSamlForbidden(url, body);
}

function looksLikeIFlightApp(body: string, url: string): boolean {
  return /iflight|crew\s*roster|neo|pairing|roster\s*period|CrewRoster|minha escala/i.test(body + url);
}

async function collectAlternativeIFlightHrefs(page: Page): Promise<Array<{ href: string; text: string }>> {
  return page.evaluate(() => {
    const out: Array<{ href: string; text: string }> = [];
    const push = (href: string, text: string) => {
      if (!href || !/^https?:\/\//i.test(href)) return;
      if (/google\.com\/account|accounts\.google\.com\/o\/oauth|accounts\.google\.com\/signin/i.test(href)) return;
      if (/iflight|neo|crew.*roster|sabapp|latam.*iflight/i.test(href) || /iflight|flight\s*neo|escala|roster/i.test(text)) {
        out.push({ href, text: text.slice(0, 120) });
      }
    };
    for (const a of Array.from(document.querySelectorAll('a[href]'))) {
      push((a as HTMLAnchorElement).href, (a.textContent || '').trim());
    }
    for (const el of Array.from(document.querySelectorAll('[data-href],[data-url],[data-link]'))) {
      const href =
        el.getAttribute('data-href') || el.getAttribute('data-url') || el.getAttribute('data-link') || '';
      if (href.startsWith('/') || href.startsWith('http')) {
        try {
          const abs = new URL(href, document.baseURI).href;
          push(abs, (el.textContent || '').trim());
        } catch {
          /* ignore */
        }
      }
    }
    return out;
  });
}

/**
 * Clica no tile iFlightNeo; regista href, telemetria; resolve workPage + root.
 * Se cair em 403 Google SAML, grava artefactos e devolve ok: false.
 */
export async function clickPrimaryIFlightNeoTile(
  context: BrowserContext,
  sabPage: Page,
  appendLog: PipelineLogFn,
  failDir: string,
): Promise<
  | { ok: true; workPage: Page; root: LocatorRoot; resolution: string; telemetry: NavTelemetry[] }
  | { ok: false; badSaml: true; badPage: Page; telemetry: NavTelemetry[]; sabPage: Page }
> {
  const tile = await findIFlightNeoTile(sabPage);
  if (!tile) {
    await appendLog({ step: 'iflightneo_tile', ok: false, message: 'Tile iFlightNeo não encontrado' });
    throw new Error('Tile iFlightNeo não encontrado');
  }

  const diag = await extractTileDiagnostics(tile);
  const tilePreview = await tile.innerText({ timeout: 5_000 }).catch(() => '');
  await appendLog({
    step: 'iflightneo_tile',
    ok: true,
    phase: 'pre_click',
    tileTextSample: tilePreview.slice(0, 160),
    hrefFromTile: diag.href,
    tagName: diag.tagName,
    outerHtmlSample: diag.outerHtml.slice(0, 500),
  });

  const telemetry: NavTelemetry[] = [];
  const detachSab = attachPageTelemetry(sabPage, telemetry);

  const popupPromise = sabPage.waitForEvent('popup', { timeout: 45_000 }).catch(() => null);
  const pagePromise = context.waitForEvent('page', { timeout: 45_000 }).catch(() => null);

  await tile.scrollIntoViewIfNeeded().catch(() => {});
  await tile.click({ timeout: 30_000 }).catch(async () => {
    await tile.click({ timeout: 15_000, force: true });
  });

  const popup = await popupPromise;
  const newPg = await pagePromise;

  let workPage: Page = sabPage;
  if (popup) workPage = popup;
  else if (newPg) workPage = newPg;

  detachSab();
  const detachWork = attachPageTelemetry(workPage, telemetry);

  await workPage.waitForLoadState('domcontentloaded', { timeout: 90_000 }).catch(() => {});
  await workPage.waitForTimeout(2_500);

  const finalUrl = workPage.url();
  await appendLog({
    step: 'iflight_navigation',
    finalUrl,
    openedNew: workPage !== sabPage,
    telemetry: telemetry.slice(-50),
  });

  if (await pageLooksLikeGoogle403(workPage)) {
    await appendLog({
      step: 'google_saml_403',
      finalUrl,
      bodySample: (await workPage.locator('body').innerText({ timeout: 8_000 }).catch(() => '')).slice(0, 400),
      hint: 'app_not_configured_for_user / SAML Google inválido para este utilizador',
    });
    await saveFailureArtifacts(workPage, failDir, 'google-saml-403');
    await appendLog({ step: 'artifact_saved', tag: 'google-saml-403' });
    detachWork();
    log(SCOPE, 'warn', 'google403', { finalUrl });
    return { ok: false, badSaml: true, badPage: workPage, telemetry, sabPage };
  }

  detachWork();

  if (workPage !== sabPage) {
    const root = await pickRosterRoot(workPage);
    const resolution = popup ? 'popup' : 'new_tab';
    await appendLog({ step: 'iflight_surface', resolution, url: workPage.url() });
    return { ok: true, workPage, root, resolution, telemetry };
  }

  await sabPage.waitForTimeout(1_500);
  await sabPage.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});
  const frame = await pickIFlightFrame(sabPage);
  if (frame) {
    await appendLog({ step: 'iflight_surface', resolution: 'iframe', frameUrl: frame.url() });
    return { ok: true, workPage: sabPage, root: frame, resolution: 'iframe', telemetry };
  }

  await appendLog({ step: 'iflight_surface', resolution: 'same_page', url: sabPage.url() });
  const root = await pickRosterRoot(sabPage);
  return { ok: true, workPage: sabPage, root, resolution: 'same_page', telemetry };
}

export async function tryAlternativeIFlightLinks(
  context: BrowserContext,
  sabPage: Page,
  appendLog: PipelineLogFn,
  failDir: string,
): Promise<{ workPage: Page; root: LocatorRoot } | null> {
  const raw = await collectAlternativeIFlightHrefs(sabPage);
  const seen = new Set<string>();
  const candidates = raw.filter((c) => {
    if (seen.has(c.href)) return false;
    seen.add(c.href);
    return true;
  });
  await appendLog({
    step: 'iflight_fallback_candidates',
    count: candidates.length,
    sample: candidates.slice(0, 15),
  });

  for (let i = 0; i < Math.min(candidates.length, 10); i++) {
    const c = candidates[i];
    if (/accounts\.google\.com|google\.com\/signin|\/o\/oauth/i.test(c.href)) {
      await appendLog({ step: 'iflight_fallback_skip', reason: 'google_oauth', href: c.href });
      continue;
    }

    await appendLog({ step: 'iflight_fallback_try', index: i, href: c.href, text: c.text });

    const tab = await context.newPage();
    const telemetry: NavTelemetry[] = [];
    const detach = attachPageTelemetry(tab, telemetry);

    try {
      await tab.goto(c.href, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await tab.waitForTimeout(2_500);

      const url = tab.url();
      const body = await tab.locator('body').innerText({ timeout: 12_000 }).catch(() => '');

      await appendLog({
        step: 'iflight_fallback_nav',
        index: i,
        finalUrl: url,
        telemetry: telemetry.slice(-25),
      });

      if (isGoogleSamlForbidden(url, body)) {
        await saveFailureArtifacts(tab, failDir, `fallback-google403-${i}`);
        await appendLog({ step: 'iflight_fallback_403', index: i, url });
        detach();
        await tab.close().catch(() => {});
        continue;
      }

      if (looksLikeIFlightApp(body, url)) {
        await appendLog({ step: 'iflight_fallback_success', index: i, url });
        const root = await pickRosterRoot(tab);
        detach();
        return { workPage: tab, root };
      }
    } catch (e) {
      await appendLog({
        step: 'iflight_fallback_error',
        index: i,
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      detach();
    }
    await tab.close().catch(() => {});
  }

  return null;
}

/**
 * Fecha separador 403 SAML e tenta hrefs alternativos no SAB.
 */
export async function openIFlightNeoWithFallbacks(
  context: BrowserContext,
  sabPage: Page,
  appendLog: PipelineLogFn,
  failDir: string,
): Promise<{ workPage: Page; root: LocatorRoot; resolution: string }> {
  const primary = await clickPrimaryIFlightNeoTile(context, sabPage, appendLog, failDir);

  if (primary.ok) {
    return {
      workPage: primary.workPage,
      root: primary.root,
      resolution: primary.resolution,
    };
  }

  if (primary.badSaml && primary.badPage !== primary.sabPage) {
    await appendLog({ step: 'iflight_close_bad_tab', url: primary.badPage.url() });
    await primary.badPage.close().catch(() => {});
  }

  await appendLog({
    step: 'iflight_primary_failed_saml',
    message: 'A tentar caminhos alternativos no SAB (hrefs sem OAuth Google)',
  });

  const alt = await tryAlternativeIFlightLinks(context, sabPage, appendLog, failDir);
  if (alt) {
    return { workPage: alt.workPage, root: alt.root, resolution: 'fallback_href' };
  }

  throw new Error(
    'iFlight inacessível: tile iFlightNeo abre SAML Google 403 e não há link alternativo válido no SAB',
  );
}
