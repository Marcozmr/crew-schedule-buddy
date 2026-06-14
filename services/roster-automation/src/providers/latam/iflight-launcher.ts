/**
 * Abertura do iFlight com diagnóstico (href, redirects, 403 Google SAML) e fallbacks no SAB.
 * Ordem de tentativa: tile SAB → deep link direto → hrefs alternativos.
 */
import type { BrowserContext, Frame, Locator, Page } from 'playwright';
import { saveFailureArtifacts } from '../../artifacts.js';
import { log } from '../../logger.js';
import { config } from '../../config.js';
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
 * Tenta aceder ao iFlight Neo via deep link direto (iflightla.ibsplc.aero).
 * Útil quando o tile SAB não é encontrado ou falha com SAML 403.
 */
export async function tryIFlightDirectDeepLink(
  context: BrowserContext,
  appendLog: PipelineLogFn,
  deepLinkUrl: string,
): Promise<{ workPage: Page; root: LocatorRoot } | null> {
  await appendLog({ step: 'iflight_deep_link', phase: 'try', url: deepLinkUrl });
  const tab = await context.newPage();
  const telemetry: NavTelemetry[] = [];
  const detach = attachPageTelemetry(tab, telemetry);
  try {
    await tab.goto(deepLinkUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await tab.waitForTimeout(3_000);
    const finalUrl = tab.url();
    const body = await tab.locator('body').innerText({ timeout: 12_000 }).catch(() => '');
    await appendLog({
      step: 'iflight_deep_link',
      phase: 'after_goto',
      finalUrl,
      bodySample: body.slice(0, 300),
      telemetry: telemetry.slice(-20),
    });
    if (isGoogleSamlForbidden(finalUrl, body)) {
      await appendLog({ step: 'iflight_deep_link', phase: 'google_saml_403', finalUrl });
      detach();
      await tab.close().catch(() => {});
      return null;
    }
    if (looksLikeIFlightApp(body, finalUrl)) {
      await appendLog({ step: 'iflight_deep_link', phase: 'success', finalUrl });
      detach();
      const root = await pickRosterRoot(tab);
      return { workPage: tab, root };
    }
    await appendLog({
      step: 'iflight_deep_link',
      phase: 'not_recognized',
      finalUrl,
      hint: 'Não parece iFlight — possível redirecionamento para login',
    });
    detach();
    await tab.close().catch(() => {});
    return null;
  } catch (e) {
    await appendLog({
      step: 'iflight_deep_link',
      phase: 'error',
      message: e instanceof Error ? e.message : String(e),
    });
    detach();
    await tab.close().catch(() => {});
    return null;
  }
}

/**
 * Fluxo de abertura do iFlight Neo em 3 tentativas:
 * 1. Clicar no tile SAB (iFlightNeo / iFlight / eCrew)
 * 2. Deep link direto (iflightla.ibsplc.aero/iflight-crew/web/getMainPage)
 * 3. Hrefs alternativos encontrados na página SAB
 */
export async function openIFlightNeoWithFallbacks(
  context: BrowserContext,
  sabPage: Page,
  appendLog: PipelineLogFn,
  failDir: string,
): Promise<{ workPage: Page; root: LocatorRoot; resolution: string }> {
  let hadSamlError = false;
  let badSamlPage: Page | null = null;

  // ── Tentativa 1: clicar no tile iFlight Neo / eCrew no SAB ──────────────
  try {
    const primary = await clickPrimaryIFlightNeoTile(context, sabPage, appendLog, failDir);
    if (primary.ok) {
      return { workPage: primary.workPage, root: primary.root, resolution: primary.resolution };
    }
    hadSamlError = primary.badSaml;
    if (primary.badSaml && primary.badPage !== primary.sabPage) {
      badSamlPage = primary.badPage;
    }
  } catch (tileErr) {
    await appendLog({
      step: 'iflight_tile_error',
      message: tileErr instanceof Error ? tileErr.message : String(tileErr),
      hint: 'tile_not_found_or_click_failed — passando para deep link',
    });
  }

  if (badSamlPage) {
    await appendLog({ step: 'iflight_close_bad_tab', url: badSamlPage.url() });
    await badSamlPage.close().catch(() => {});
  }

  // ── Tentativa 2: deep link direto ───────────────────────────────────────
  const deepLinkUrl = config.iflightDeepLinkUrl();
  if (deepLinkUrl) {
    await appendLog({
      step: 'iflight_fallback_deep_link',
      message: 'Tile inacessível — tentando deep link direto para o iFlight Neo',
      deepLinkUrl,
    });
    const deepResult = await tryIFlightDirectDeepLink(context, appendLog, deepLinkUrl);
    if (deepResult) {
      return { workPage: deepResult.workPage, root: deepResult.root, resolution: 'deep_link' };
    }
  }

  // ── Tentativa 3: hrefs alternativos descobertos no DOM do SAB ───────────
  await appendLog({
    step: 'iflight_fallback_hrefs',
    message: 'Deep link inválido — tentando hrefs alternativos no SAB',
  });
  const alt = await tryAlternativeIFlightLinks(context, sabPage, appendLog, failDir);
  if (alt) {
    return { workPage: alt.workPage, root: alt.root, resolution: 'fallback_href' };
  }

  throw new Error(
    hadSamlError
      ? 'iFlight inacessível: SAML Google 403, deep link falhou e nenhum href alternativo válido no SAB'
      : 'iFlight inacessível: tile não encontrado, deep link falhou e nenhum href alternativo válido no SAB',
  );
}
