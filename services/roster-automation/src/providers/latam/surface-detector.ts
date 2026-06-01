/**
 * Deteção robusta de superfície: host + pathname + título + amostra de texto (não só URL).
 */
import type { Page } from 'playwright';
import { isGoogleAuthHost, isMicrosoftSsoHost } from './sso-hosts.js';

export type CorporateSurface =
  | 'latam_corporate_home'
  | 'corporate_login'
  | 'google_auth'
  | 'microsoft_auth'
  | 'post_sso_latam'
  | 'portal_sab_home'
  | 'aims_ecrew_home'
  | 'ecrew_roster_report'
  | 'iflight_home'
  | 'iflight_roster_calendar'
  | 'iflight_roster_report'
  | 'unknown';

export interface SurfaceSignals {
  surface: CorporateSurface;
  url: string;
  host: string;
  pathname: string;
  title: string;
  bodySample: string;
}

export async function readPageSignals(page: Page): Promise<Omit<SurfaceSignals, 'surface'>> {
  const url = page.url();
  let title = '';
  try {
    title = await page.title();
  } catch {
    title = '';
  }
  const bodySample = await page.locator('body').innerText({ timeout: 10_000 }).catch(() => '');
  const u = new URL(url);
  return {
    url,
    host: u.hostname.toLowerCase(),
    pathname: u.pathname.toLowerCase(),
    title: title.slice(0, 240),
    bodySample: bodySample.slice(0, 4_000),
  };
}

/**
 * Classifica superfície a partir de URL + título + corpo (síncrono após ler sinais).
 */
export function classifySurface(signals: Omit<SurfaceSignals, 'surface'>): CorporateSurface {
  const { url, host, pathname, title, bodySample } = signals;
  const text = `${title}\n${bodySample}`;

  if (isMicrosoftSsoHost(url)) return 'microsoft_auth';
  if (isGoogleAuthHost(url)) return 'google_auth';

  if (/\/ecrew\//i.test(pathname) || /\/ecrew$/i.test(pathname)) {
    if (/RosterReport\.aspx|\/reports\//i.test(pathname + url)) {
      return 'ecrew_roster_report';
    }
    if (/aims|e\s*crew|my\s*schedule/i.test(text)) {
      return 'aims_ecrew_home';
    }
    return 'aims_ecrew_home';
  }

  if (/iflight/i.test(host) || /ibsplc/i.test(host)) {
    if (/\/iflight-crew\/web\/getmainpage/i.test(pathname) || /roster\s*calendar|crew\s*roster/i.test(text)) {
      return 'iflight_roster_calendar';
    }
    if (/roster\s*report|statistics|export|crewrosterreport|official\s*roster/i.test(text)) {
      return 'iflight_roster_report';
    }
    return 'iflight_home';
  }

  if (host.includes('latam.com')) {
    if (/\/web\/portalsab|\/portalsab/i.test(pathname) || /portal\s*sab|portalsab/i.test(text)) {
      return 'portal_sab_home';
    }
    if (/\/group\/corporativo/i.test(pathname) || /corporativo[\s-]*latam/i.test(text)) {
      return 'latam_corporate_home';
    }
    if (
      /\/(login|signin)(\/|$)/i.test(pathname) ||
      /entrar\s+com|sign\s*in\s+with|login\s+with\s+microsoft/i.test(text.slice(0, 1_500))
    ) {
      return 'corporate_login';
    }
    if (
      /bem-?vindo|welcome|portal|latam|tripul|neo|sab|dashboard/i.test(text) &&
      !/entrar\s+com\s+microsoft|sign\s*in\s+with/i.test(text.slice(0, 800))
    ) {
      return 'post_sso_latam';
    }
  }

  return 'unknown';
}

export async function detectCorporateSurface(page: Page): Promise<SurfaceSignals> {
  const base = await readPageSignals(page);
  const surface = classifySurface(base);
  return { surface, ...base };
}
