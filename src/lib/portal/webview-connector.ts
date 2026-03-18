import {
  PORTAL_SESSION_STORAGE_KEY,
  type PortalAuthRequest,
  type PortalSessionSnapshot,
} from '@/lib/portal/types';

const MICROSOFT_LOGIN_HOST = 'login.microsoftonline.com';
const POPUP_FEATURES = 'popup=yes,width=480,height=760,noopener,noreferrer';

export function openPortalLogin(authRequest: PortalAuthRequest) {
  const popup = window.open(authRequest.loginUrl, 'portal-auth-session', POPUP_FEATURES);

  if (!popup) {
    throw new Error('Não foi possível abrir o login corporativo. Verifique se o bloqueio de pop-up está desativado.');
  }

  popup.focus();
  return popup;
}

export function detectRedirect(url: string | null | undefined) {
  if (!url) return false;

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.length > 0 && !hostname.endsWith(MICROSOFT_LOGIN_HOST);
  } catch {
    return false;
  }
}

export function createPortalSessionSnapshot(lastObservedUrl: string | null = null): PortalSessionSnapshot {
  return {
    provider: 'generic_sso',
    connectedAt: new Date().toISOString(),
    lastObservedUrl,
    loginDomain: MICROSOFT_LOGIN_HOST,
    sessionMode: 'browser_managed',
  };
}

export function storePortalSession(snapshot: PortalSessionSnapshot) {
  localStorage.setItem(PORTAL_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export function readPortalSession(): PortalSessionSnapshot | null {
  const raw = localStorage.getItem(PORTAL_SESSION_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PortalSessionSnapshot;
  } catch {
    localStorage.removeItem(PORTAL_SESSION_STORAGE_KEY);
    return null;
  }
}

export function clearPortalSession() {
  localStorage.removeItem(PORTAL_SESSION_STORAGE_KEY);
}
