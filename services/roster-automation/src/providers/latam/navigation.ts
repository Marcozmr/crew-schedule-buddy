/**
 * Navegação tolerante a mudanças de DOM no portal LATAM / SAB / iFlight.
 * Prioridade: texto visível e papéis ARIA; tiles costumam ser div/button, não só links.
 *
 * SSO Microsoft: a deteção de “ainda no login” não pode usar o substring genérico "login"
 * (ex.: login.microsoftonline.com contém "login" no hostname e quebrava a heurística antiga).
 */
import type { BrowserContext, Frame, Page } from 'playwright';
import { withRetries } from '../../retry.js';

const STEP_TIMEOUT_MS = 45_000;

/** Hosts Microsoft onde o utilizador ainda está no fluxo SSO (não confundir com portal LATAM). */
const MS_LOGIN_HOST_RE =
  /^(?:login\.|device\.login\.|.*\.b2clogin\.)/i;

export function isMicrosoftSsoHost(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    const h = u.hostname.toLowerCase();
    if (MS_LOGIN_HOST_RE.test(h)) return true;
    if (h === 'login.microsoftonline.com' || h.endsWith('.login.microsoftonline.com')) return true;
    if (h === 'login.live.com' || h.endsWith('.login.live.com')) return true;
    if (h.includes('microsoftonline.com') || h.includes('microsoft.com')) {
      const path = u.pathname + u.search;
      if (/\/oauth|\/authorize|\/login|\/signin|\/saml|\/wsfed|\/kmsi|\/common\//i.test(path)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Superfície LATAM / iFlight / SAB após redirecionamento pós-SSO (não é página de login Microsoft). */
export function isPostSsoLatamSurface(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (isMicrosoftSsoHost(urlStr)) return false;
    const h = u.hostname.toLowerCase();
    const p = u.pathname.toLowerCase();
    return (
      h.includes('latam') ||
      h.includes('iflight') ||
      h.includes('sab') ||
      p.includes('/sab') ||
      /\.latam\.|latam\.com|iflight/i.test(h + p)
    );
  } catch {
    return false;
  }
}

/** Ainda numa rota explícita de login no domínio corporativo (não Microsoft). */
function isCorporateLoginPath(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (isMicrosoftSsoHost(urlStr)) return true;
    const h = u.hostname.toLowerCase();
    const p = u.pathname.toLowerCase();
    if (!h.includes('latam') && !h.includes('iflight')) return false;
    // Redirecionamentos pós-SSO (não bloquear como "login")
    if (/\/callback|signin-oidc|saml2?\/post|\/acs|\/consume|\/oauth2?\/callback/i.test(p)) return false;
    return /\/(login|signin)(\/|$)/i.test(p) || /\/authorize(\/|$)/i.test(p);
  } catch {
    return false;
  }
}

/**
 * Aguarda saída do Microsoft SSO e chegada a uma URL LATAM / iFlight / SAB, depois confirma sessão.
 * Não depende de botões na app — só URL, cookies opcionais e texto da página.
 */
export async function waitForAuthenticationAfterSso(
  page: Page,
  context: BrowserContext,
  opts: {
    deadlineMs: number;
    appendLog?: (entry: Record<string, unknown>) => void;
    waitForUrlTimeoutMs?: number;
  },
): Promise<boolean> {
  const { deadlineMs, appendLog, waitForUrlTimeoutMs = 120_000 } = opts;
  const deadline = Date.now() + deadlineMs;

  appendLog?.({
    step: 'login_detected',
    message: 'Fluxo SSO (Microsoft) em curso — a aguardar redirecionamento para o portal LATAM / iFlight',
    url: page.url(),
  });

  const urlPhaseTimeout = Math.min(waitForUrlTimeoutMs, Math.max(10_000, deadline - Date.now() - 5_000));

  try {
    await page.waitForURL(
      (url: URL) => isPostSsoLatamSurface(url.href),
      { timeout: urlPhaseTimeout, waitUntil: 'domcontentloaded' },
    );
    appendLog?.({
      step: 'redirect_detected',
      message: 'Redirecionamento pós-SSO para superfície LATAM / iFlight',
      url: page.url(),
    });
  } catch {
    appendLog?.({
      step: 'redirect_detected',
      message:
        'waitForURL(latam|iflight) expirou ou já estava na página — a validar com URL/cookies/DOM',
      url: page.url(),
    });
  }

  while (Date.now() < deadline) {
    if (await expectAuthenticatedHome(page, context)) return true;
    await page.waitForTimeout(2_000);
  }

  appendLog?.({
    step: 'session_validated',
    ok: false,
    message: 'Prazo esgotado sem confirmar sessão pós-SSO',
    url: page.url(),
  });
  return false;
}

/** Cookies com domínio LATAM/iflight — reforço quando o DOM ainda está a carregar. */
async function hasLatamSessionCookies(context: BrowserContext): Promise<boolean> {
  try {
    const cookies = await context.cookies();
    return cookies.some(
      (c) =>
        (/latam|iflight|sab/i.test(c.domain) && c.value.length > 8) ||
        (/\.latam\./i.test(c.domain) && c.name.length > 0),
    );
  } catch {
    return false;
  }
}

export type LocatorRoot = Page | Frame;

export async function clickFirstMatching(
  root: LocatorRoot,
  patterns: RegExp[],
  role: 'link' | 'button' | 'tab' | 'menuitem' = 'link',
): Promise<boolean> {
  for (const re of patterns) {
    try {
      const loc = root.getByRole(role, { name: re });
      const n = await loc.count();
      if (n > 0) {
        await loc.first().click({ timeout: STEP_TIMEOUT_MS });
        return true;
      }
    } catch {
      /* try next */
    }
  }
  for (const re of patterns) {
    try {
      const loc = root.getByText(re, { exact: false });
      const n = await loc.count();
      if (n > 0) {
        await loc.first().click({ timeout: STEP_TIMEOUT_MS });
        return true;
      }
    } catch {
      /* try next */
    }
  }
  return false;
}

export async function expectAuthenticatedHome(page: Page, context?: BrowserContext): Promise<boolean> {
  const url = page.url();
  if (isMicrosoftSsoHost(url)) return false;
  if (isCorporateLoginPath(url)) return false;

  if (isPostSsoLatamSurface(url)) {
    const bodyQuick = await page.locator('body').innerText({ timeout: 8_000 }).catch(() => '');
    if (bodyQuick.length > 80 && !/sign\s*in|entrar|login\s*with\s*microsoft/i.test(bodyQuick.slice(0, 2_000))) {
      return true;
    }
  }

  const body = await page.locator('body').innerText({ timeout: 15_000 }).catch(() => '');
  const markers = [
    /portal/i,
    /bem-?vindo|welcome/i,
    /latam/i,
    /tripul/i,
    /crew/i,
    /iflight/i,
    /sab/i,
    /neo/i,
    /dashboard/i,
    /minha\s*escala|my\s*schedule/i,
  ];
  const urlHints = /latam|iflight|sab|portal|neo|tripul|crew/i.test(url);
  const textHit = markers.some((re) => re.test(body));
  if (textHit || (urlHints && body.length > 50)) return true;

  if (context && (await hasLatamSessionCookies(context))) {
    return isPostSsoLatamSurface(url) || urlHints;
  }

  return false;
}

/**
 * Aguarda superfície do Portal SAB (URL ou texto) ou presença do tile iFlightNeo.
 */
export async function waitForSabPortalSurface(page: Page, settleMs = 2_500): Promise<boolean> {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const url = page.url();
    const body = await page.locator('body').innerText({ timeout: 12_000 }).catch(() => '');
    const hit =
      /\/sab\b|sab\.latam|portal.*sab|sab\/portal/i.test(url) ||
      /portal\s*sab|sab\s*neo|iFlightNeo|iFlight\s*Neo/i.test(body) ||
      /^\s*SAB\s*$/im.test(body);
    if (hit) {
      await page.waitForTimeout(settleMs);
      return true;
    }
    await page.waitForTimeout(2_000);
  }
  return false;
}

export async function gotoIFlightArea(page: Page): Promise<boolean> {
  await withRetries('gotoIFlight', 3, 2_000, async () => {
    const ok = await clickFirstMatching(
      page,
      [/iFlightNeo/i, /iFlight\s*Neo/i, /iFlight/i, /Crew\s*Roster/i, /Escala/i, /Schedule/i, /Roster/i],
      'link',
    );
    if (!ok) {
      const okBtn = await clickFirstMatching(
        page,
        [/iFlightNeo/i, /iFlight\s*Neo/i, /iFlight/i],
        'button',
      );
      if (!okBtn) throw new Error('Nenhum tile/link iFlightNeo encontrado');
    }
  });
  return true;
}

const CREW_ROSTER_PATTERNS = [
  /CrewRosterReport/i,
  /Crew\s*Roster\s*Report/i,
  /Official\s*Roster/i,
  /Exportar.*PDF/i,
  /Export.*PDF/i,
  /Download.*PDF/i,
  /\bPDF\b.*[Rr]oster/i,
  /Relat[oó]rio.*[Rr]oster/i,
];

/**
 * Aciona exportação/download do PDF da escala (botão ou link).
 */
export async function triggerCrewRosterDownload(root: LocatorRoot): Promise<boolean> {
  let clicked = await clickFirstMatching(root, CREW_ROSTER_PATTERNS, 'button');
  if (clicked) return true;
  clicked = await clickFirstMatching(root, CREW_ROSTER_PATTERNS, 'link');
  if (clicked) return true;
  const menu = root.locator('[class*="menu" i], [role="menu"], header, nav').filter({ hasText: /[Rr]oster|[Ee]xport|[Pp]df/i });
  if ((await menu.count()) > 0) {
    try {
      await menu.first().click({ timeout: 15_000 });
      clicked = await clickFirstMatching(root, CREW_ROSTER_PATTERNS, 'button');
      if (clicked) return true;
    } catch {
      /* fall through */
    }
  }
  return false;
}

export function pickDownloadTimeoutMs(): number {
  return 180_000;
}

/** Localiza input file escondido se o portal usar upload em vez de download direto. */
export async function findPdfInput(page: Page) {
  const inputs = page.locator('input[type="file"][accept*="pdf"], input[type="file"]');
  const c = await inputs.count();
  if (c === 0) return null;
  return inputs.first();
}
