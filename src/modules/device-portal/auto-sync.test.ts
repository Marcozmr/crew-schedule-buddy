import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  native: true,
  syncPortal: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => h.native } }));
vi.mock('@/lib/pdf-import', () => ({ importPdfArrayBuffer: vi.fn(), importIflightRosterJson: vi.fn() }));
vi.mock('./portal-session', () => ({ syncPortal: h.syncPortal }));

import { AUTO_SYNC_INTERVAL_MS, autoSyncPortal } from './auto-sync';
import { savePortalState } from './session-store';

const NOW = new Date('2026-11-19T15:00:00.000Z');
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3_600_000).toISOString();

beforeEach(() => {
  localStorage.clear();
  h.native = true;
  vi.clearAllMocks();
  h.syncPortal.mockResolvedValue({ kind: 'imported', parsedCount: 30, insertedCount: 30, duplicate: false });
});

describe('autoSyncPortal', () => {
  it('intervalo de 3 horas', () => {
    expect(AUTO_SYNC_INTERVAL_MS).toBe(3 * 3_600_000);
  });

  it('sessão salva e última leitura antiga: sincroniza escondido e avisa que a escala mudou', async () => {
    savePortalState('latam', { status: 'saved', lastSyncAt: hoursAgo(4) });
    const updated = vi.fn();
    window.addEventListener('escalax:roster-updated', updated);

    await expect(autoSyncPortal('u1', NOW)).resolves.toBe('imported');

    expect(h.syncPortal).toHaveBeenCalledTimes(1);
    expect(updated).toHaveBeenCalledTimes(1);
    expect((updated.mock.calls[0][0] as CustomEvent).detail).toMatchObject({ userId: 'u1', reason: 'portal_sync_auto' });
    window.removeEventListener('escalax:roster-updated', updated);
  });

  it('leitura recente: não abre nada', async () => {
    savePortalState('latam', { status: 'saved', lastSyncAt: hoursAgo(1) });
    await expect(autoSyncPortal('u1', NOW)).resolves.toBe('skipped');
    expect(h.syncPortal).not.toHaveBeenCalled();
  });

  it('nunca conectado ou sessão expirada: não abre nada', async () => {
    await expect(autoSyncPortal('u1', NOW)).resolves.toBe('skipped');
    savePortalState('latam', { status: 'expired', lastSyncAt: hoursAgo(10) });
    await expect(autoSyncPortal('u1', NOW)).resolves.toBe('skipped');
    expect(h.syncPortal).not.toHaveBeenCalled();
  });

  it('fora do app instalado: não abre nada', async () => {
    h.native = false;
    savePortalState('latam', { status: 'saved', lastSyncAt: hoursAgo(10) });
    await expect(autoSyncPortal('u1', NOW)).resolves.toBe('skipped');
    expect(h.syncPortal).not.toHaveBeenCalled();
  });

  it('chamada repetida enquanto sincroniza: só uma sincronização', async () => {
    savePortalState('latam', { status: 'saved', lastSyncAt: hoursAgo(5) });
    let release: () => void = () => {};
    h.syncPortal.mockImplementation(() => new Promise((r) => { release = () => r({ kind: 'cancelled' }); }));

    const first = autoSyncPortal('u1', NOW);
    await expect(autoSyncPortal('u1', NOW)).resolves.toBe('skipped');
    release();
    await expect(first).resolves.toBe('cancelled');
    expect(h.syncPortal).toHaveBeenCalledTimes(1);
  });
});
