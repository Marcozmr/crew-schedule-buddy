/**
 * Navegação tolerante a mudanças de DOM no portal LATAM / SAB / iFlight.
 * Prioridade: texto visível e papéis ARIA; tiles costumam ser div/button, não só links.
 *
 * SSO Microsoft: a deteção de “ainda no login” não pode usar o substring genérico "login"
 * (ex.: login.microsoftonline.com contém "login" no hostname e quebrava a heurística antiga).
 */
import type { BrowserContext, Frame, Page } from 'playwright';
import { withRetries } from '../../retry.js';
import { isMicrosoftSsoHost } from './sso-hosts.js';
import { detectCorporateSurface } from './surface-detector.js';

export { isMicrosoftSsoHost } from './sso-hosts.js';

const STEP_TIMEOUT_MS = 45_000;

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
export type SsoPollInfo = {
  surface: string;
  url: string;
  host: string;
  fsmHint: 'waiting_sso' | 'authenticated_pending';
};

export async function waitForAuthenticationAfterSso(
  page: Page,
  context: BrowserContext,
  opts: {
    deadlineMs: number;
    appendLog?: (entry: Record<string, unknown>) => void;
    waitForUrlTimeoutMs?: number;
    /** Chamado ~2s em ~2s durante a espera — para FSM (waiting_sso) e observabilidade. */
    onPoll?: (info: SsoPollInfo) => void | Promise<void>;
    /** Checado a cada iteração do polling — permite abortar quando o usuário cancela pelo app. */
    isCancelled?: () => boolean;
  },
): Promise<boolean> {
  const { deadlineMs, appendLog, waitForUrlTimeoutMs = 120_000, onPoll, isCancelled } = opts;
  const deadline = Date.now() + deadlineMs;

  appendLog?.({
    step: 'login_detected',
    message: 'Fluxo SSO (Microsoft/Google) em curso — a aguardar redirecionamento para o portal LATAM / iFlight',
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
    if (isCancelled?.()) {
      appendLog?.({ step: 'cancelled', message: 'Conexão cancelada pelo usuário' });
      throw new Error('Conexão cancelada pelo usuário');
    }
    try {
      const det = await detectCorporateSurface(page);
      const ssoActive = det.surface === 'microsoft_auth' || det.surface === 'google_auth';
      await onPoll?.({
        surface: det.surface,
        url: det.url,
        host: det.host,
        fsmHint: ssoActive ? 'waiting_sso' : 'authenticated_pending',
      });
      if (ssoActive) {
        appendLog?.({
          step: 'sso_surface_poll',
          surface: det.surface,
          url: det.url,
          title: det.title.slice(0, 120),
        });
      }
    } catch {
      /* página em transição */
    }
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

async function clickFirstMatchingAnyRole(root: LocatorRoot, patterns: RegExp[]): Promise<boolean> {
  for (const role of ['link', 'button', 'tab', 'menuitem'] as const) {
    if (await clickFirstMatching(root, patterns, role)) return true;
  }
  return false;
}

const ROSTER_CALENDAR_MARKERS = /calend[aá]rio\s*do\s*elenco|roster\s*calendar|crew\s*roster\s*calendar/i;

/**
 * O iFlight Neo abre em "Casa" (painel genérico, sem dados de escala) — é preciso navegar
 * explicitamente até Elenco → Calendário do Elenco para ver a grade de voos/escala.
 * Idempotente: se o marcador já estiver na página, não clica em nada.
 */
export async function openCrewRosterCalendar(root: LocatorRoot): Promise<boolean> {
  const bodyText = await root.locator('body').innerText({ timeout: 8_000 }).catch(() => '');
  if (ROSTER_CALENDAR_MARKERS.test(bodyText)) return true;

  const openedElenco = await clickFirstMatchingAnyRole(root, [/^Elenco$/i, /Elenco/i, /^Crew$/i, /^Roster$/i]);
  if (!openedElenco) return false;

  await new Promise((r) => setTimeout(r, 1_500));

  await clickFirstMatchingAnyRole(root, [
    /Calend[aá]rio\s*do\s*Elenco/i,
    /Roster\s*Calendar/i,
    /Crew\s*Roster\s*Calendar/i,
    /Calend[aá]rio/i,
  ]);

  return true;
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
  /Roster\s*Report/i,
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
