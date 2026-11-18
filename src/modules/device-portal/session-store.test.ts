import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPortalState, resetPortalState, savePortalState } from './session-store';

const INITIAL = { status: 'never', lastSyncAt: null, learned: null, lastError: null };

describe('estado local do portal', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('sem nada salvo, começa como "nunca conectado"', () => {
    expect(loadPortalState('latam')).toEqual(INITIAL);
  });

  it('salva mesclando com o que já existia', () => {
    savePortalState('latam', { status: 'saved', lastSyncAt: '2026-11-18T13:03:00.000Z' });
    savePortalState('latam', { learned: { method: 'GET', url: 'https://iflightla.ibsplc.aero/r' } });
    expect(loadPortalState('latam')).toEqual({
      status: 'saved',
      lastSyncAt: '2026-11-18T13:03:00.000Z',
      learned: { method: 'GET', url: 'https://iflightla.ibsplc.aero/r' },
      lastError: null,
    });
  });

  it('guarda em escalax.devicePortal.<id>', () => {
    savePortalState('latam', { status: 'expired' });
    expect(localStorage.getItem('escalax.devicePortal.latam')).toContain('"expired"');
  });

  it('reset volta ao inicial', () => {
    savePortalState('latam', { status: 'saved' });
    resetPortalState('latam');
    expect(loadPortalState('latam')).toEqual(INITIAL);
  });

  it('localStorage quebrado não derruba a leitura', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(loadPortalState('latam')).toEqual(INITIAL);
  });

  it('JSON corrompido volta ao inicial', () => {
    localStorage.setItem('escalax.devicePortal.latam', '{quebrado');
    expect(loadPortalState('latam')).toEqual(INITIAL);
  });
});
