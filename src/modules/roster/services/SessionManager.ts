/**
 * Session Manager — gerencia estado de sessão e conexão por provider.
 * Persiste apenas estado de UX (conectado/não). Não armazena credenciais, tokens ou cookies.
 */

import type { RosterProviderId, ConnectionStatus } from '../types';

export type SessionKind = 'corporate_portal' | 'pdf' | 'manual' | 'iflight';

/** Identificador do portal corporativo configurado (ex.: LATAM). */
export const CORPORATE_PORTAL_PROVIDER_ID = 'latam_portal' as const;

export interface CorporatePortalConnection {
  status: ConnectionStatus;
  connectedAt: string | null;
  lastCheckedAt: string | null;
  error: string | null;
  /** Provider de portal (ex.: latam_portal). */
  providerId: string | null;
  /** Tipo de sessão persistida (UX apenas). */
  sessionKind: SessionKind | null;
}

export interface RosterSession {
  providerId: RosterProviderId;
  kind: SessionKind;
  status: ConnectionStatus;
  lastSyncAt: string | null;
  expiresAt: string | null;
}

const SESSION_KEY = 'escalax_roster_session';
const CORPORATE_PORTAL_KEY = 'escalax_corporate_portal_connection';

function normalizeCorporate(raw: Partial<CorporatePortalConnection> | null): CorporatePortalConnection {
  if (!raw) {
    return {
      status: 'disconnected',
      connectedAt: null,
      lastCheckedAt: null,
      error: null,
      providerId: null,
      sessionKind: null,
    };
  }
  const status = raw.status === 'error' ? 'failed' : raw.status;
  return {
    status: status ?? 'disconnected',
    connectedAt: raw.connectedAt ?? null,
    lastCheckedAt: raw.lastCheckedAt ?? null,
    error: raw.error ?? null,
    providerId: raw.providerId ?? null,
    sessionKind: raw.sessionKind ?? null,
  };
}

export const SessionManager = {
  get(): RosterSession | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as RosterSession) : null;
    } catch {
      return null;
    }
  },

  set(session: RosterSession | null): void {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  },

  clear(): void {
    localStorage.removeItem(SESSION_KEY);
  },

  updateLastSync(providerId: RosterProviderId, lastSyncAt: string): void {
    const current = SessionManager.get();
    if (current && current.providerId === providerId) {
      SessionManager.set({ ...current, lastSyncAt });
    }
  },

  /** Estado da conexão corporativa (apenas UX, sem credenciais). */
  getCorporatePortal(): CorporatePortalConnection {
    try {
      const raw = localStorage.getItem(CORPORATE_PORTAL_KEY);
      if (!raw) {
        return normalizeCorporate(null);
      }
      return normalizeCorporate(JSON.parse(raw) as Partial<CorporatePortalConnection>);
    } catch {
      return normalizeCorporate(null);
    }
  },

  /** Alias semântico — mesmo que getCorporatePortal(). */
  getCorporateStatus(): CorporatePortalConnection {
    return SessionManager.getCorporatePortal();
  },

  setCorporatePortal(connection: CorporatePortalConnection): void {
    localStorage.setItem(CORPORATE_PORTAL_KEY, JSON.stringify(connection));
  },

  setCorporatePortalConnected(): void {
    const now = new Date().toISOString();
    SessionManager.setCorporatePortal({
      status: 'connected',
      connectedAt: now,
      lastCheckedAt: now,
      error: null,
      providerId: CORPORATE_PORTAL_PROVIDER_ID,
      sessionKind: 'corporate_portal',
    });
  },

  setCorporatePortalDisconnected(): void {
    SessionManager.setCorporatePortal({
      status: 'disconnected',
      connectedAt: null,
      lastCheckedAt: new Date().toISOString(),
      error: null,
      providerId: null,
      sessionKind: null,
    });
  },

  setCorporatePortalError(message: string): void {
    const current = SessionManager.getCorporatePortal();
    SessionManager.setCorporatePortal({
      ...current,
      status: 'failed',
      lastCheckedAt: new Date().toISOString(),
      error: message,
    });
  },

  setCorporatePortalConnecting(): void {
    const current = SessionManager.getCorporatePortal();
    SessionManager.setCorporatePortal({
      ...current,
      status: 'connecting',
      error: null,
    });
  },

  isCorporatePortalConnected(): boolean {
    return SessionManager.getCorporatePortal().status === 'connected';
  },

  /** Alias — portal corporativo conectado (UX). */
  isCorporateConnected(): boolean {
    return SessionManager.isCorporatePortalConnected();
  },

  clearCorporatePortal(): void {
    localStorage.removeItem(CORPORATE_PORTAL_KEY);
  },

  /** Alias — desconectar portal corporativo. */
  disconnectCorporate(): void {
    SessionManager.clearCorporatePortal();
  },
};
