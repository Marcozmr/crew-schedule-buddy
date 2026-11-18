/**
 * Estado da conexão com o portal, guardado só no aparelho (localStorage).
 * A sessão em si (cookies) fica no navegador do app, não aqui.
 */
import type { LearnedEndpoint } from './providers';

export type PortalStatus = 'never' | 'saved' | 'expired';

export interface PortalState {
  status: PortalStatus;
  lastSyncAt: string | null;
  learned: LearnedEndpoint | null;
  lastError: string | null;
}

const INITIAL: PortalState = { status: 'never', lastSyncAt: null, learned: null, lastError: null };

function key(id: string): string {
  return `escalax.devicePortal.${id}`;
}

export function loadPortalState(id: string): PortalState {
  try {
    const raw = localStorage.getItem(key(id));
    if (!raw) return { ...INITIAL };
    const parsed = JSON.parse(raw) as Partial<PortalState>;
    return { ...INITIAL, ...parsed };
  } catch {
    return { ...INITIAL };
  }
}

export function savePortalState(id: string, patch: Partial<PortalState>): PortalState {
  const next = { ...loadPortalState(id), ...patch };
  try {
    localStorage.setItem(key(id), JSON.stringify(next));
  } catch {
    /* armazenamento indisponível: segue só em memória nesta chamada */
  }
  return next;
}

export function resetPortalState(id: string): void {
  try {
    localStorage.removeItem(key(id));
  } catch {
    /* nada a fazer */
  }
}
