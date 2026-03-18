import {
  PORTAL_SESSION_STORAGE_KEY,
  type PortalAuthRequest,
  type PortalSessionSnapshot,
} from '@/lib/portal/types';

const POPUP_FEATURES = 'popup=yes,width=480,height=760,noopener,noreferrer';

function matchesDomain(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function openPortalLogin(authRequest: PortalAuthRequest) {
  const popup = window.open(authRequest.loginUrl, 'portal-auth-session', POPUP_FEATURES);

  if (!popup) {
    throw new Error('Não foi possível abrir o login corporativo. Verifique se o bloqueio de pop-up está desativado.');
  }

  popup.focus();
  return popup;
}

export function detectRedirect(args: {
  url: string | null | undefined;
  authRequest: PortalAuthRequest;
  hasVisitedLoginDomain: boolean;
}) {
  const { url, authRequest, hasVisitedLoginDomain } = args;

  if (!url) {
    return {
      completed: false,
      hasVisitedLoginDomain,
      currentHost: null,
    };
  }

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const isLoginDomain = authRequest.loginDomains.some((domain) => matchesDomain(hostname, domain));
    const nextHasVisitedLoginDomain = hasVisitedLoginDomain || isLoginDomain;
    const isSuccessDomain = authRequest.successDomains.some((domain) => matchesDomain(hostname, domain));

    return {
      completed: nextHasVisitedLoginDomain && (isSuccessDomain || !isLoginDomain),
      hasVisitedLoginDomain: nextHasVisitedLoginDomain,
      currentHost: hostname,
    };
  } catch {
    return {
      completed: false,
      hasVisitedLoginDomain,
      currentHost: null,
    };
  }
}

export function createPortalSessionSnapshot(authRequest: PortalAuthRequest, lastObservedUrl: string | null = null): PortalSessionSnapshot {
  return {
    provider: 'generic_sso',
    connectedAt: new Date().toISOString(),
    lastObservedUrl,
    loginDomains: authRequest.loginDomains,
    portalDomain: authRequest.successDomains[0] ?? 'portal.latam.com',
    portalEntryUrl: authRequest.loginUrl,
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
