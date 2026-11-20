import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

const h = vi.hoisted(() => ({ sync: vi.fn(), light: vi.fn() }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/modules/device-portal/auto-sync', () => ({ autoSyncPortal: h.sync }));
vi.mock('@/modules/roster/services/ConnectedRosterAutoUpdateService', () => ({
  ConnectedRosterAutoUpdateService: { runLightUpdateCheck: h.light },
}));

import { ConnectedRosterLifecycle } from './ConnectedRosterLifecycle';

beforeEach(() => {
  vi.useFakeTimers();
  h.sync.mockReset().mockResolvedValue('skipped');
  h.light.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('ConnectedRosterLifecycle', () => {
  it('com o app aberto e parado, volta a verificar a escala a cada 15 minutos (sem precisar tocar na tela)', () => {
    const { unmount } = render(<ConnectedRosterLifecycle />);
    expect(h.sync).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(15 * 60_000);
    expect(h.sync).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(15 * 60_000);
    expect(h.sync).toHaveBeenCalledTimes(3);
    unmount();
    vi.advanceTimersByTime(15 * 60_000);
    expect(h.sync).toHaveBeenCalledTimes(3);
  });
});
