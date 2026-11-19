import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  native: true,
  unregister: vi.fn(async () => 1),
  clearCaches: vi.fn(async () => 2),
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => h.native } }));
vi.mock('@/lib/app-recovery/appRecoveryManager', () => ({
  unregisterAllServiceWorkers: h.unregister,
  clearAllAppCaches: h.clearCaches,
}));

import { cleanupServiceWorkerOnNative, shouldUseServiceWorker } from './native-service-worker';

beforeEach(() => {
  h.native = true;
  vi.clearAllMocks();
});

describe('service worker no app instalado', () => {
  it('no app instalado não usa service worker (os arquivos já estão no aparelho)', () => {
    expect(shouldUseServiceWorker()).toBe(false);
  });

  it('no navegador continua usando', () => {
    h.native = false;
    expect(shouldUseServiceWorker()).toBe(true);
  });

  it('no app instalado remove o service worker e o cache que sobraram de versões antigas', async () => {
    await cleanupServiceWorkerOnNative();
    expect(h.unregister).toHaveBeenCalledTimes(1);
    expect(h.clearCaches).toHaveBeenCalledTimes(1);
  });

  it('no navegador não mexe em nada', async () => {
    h.native = false;
    await cleanupServiceWorkerOnNative();
    expect(h.unregister).not.toHaveBeenCalled();
    expect(h.clearCaches).not.toHaveBeenCalled();
  });
});
