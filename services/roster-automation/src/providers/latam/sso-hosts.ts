/**
 * Hosts de SSO (Microsoft / Google) — partilhado por navigation e surface-detector.
 */

const MS_LOGIN_HOST_RE = /^(?:login\.|device\.login\.|.*\.b2clogin\.)/i;

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

export function isGoogleAuthHost(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    const h = u.hostname.toLowerCase();
    if (h === 'accounts.google.com') return true;
    if (h.endsWith('.google.com') && /oauth|signin|accounts/i.test(u.pathname + u.search)) return true;
    if (/googleusercontent\.com$/i.test(h)) return true;
    return false;
  } catch {
    return false;
  }
}
