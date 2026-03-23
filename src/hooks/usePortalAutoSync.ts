import { useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { maybeAutoSyncPortalConnection } from '@/lib/services/portal-sync-service';

const AUTO_SYNC_CHECK_INTERVAL_MS = 2 * 60 * 1000;

export function usePortalAutoSync(onSynced?: () => void) {
  const { user } = useAuth();

  const runAutoSync = useCallback(
    async (reason: string, force = false) => {
      if (!user) return;
      try {
        const result = await maybeAutoSyncPortalConnection({
          userId: user.id,
          reason,
          force,
        });
        if (!result.skipped) {
          console.log('[portal-sync] dashboard auto-refresh after successful sync');
          onSynced?.();
        }
      } catch (error) {
        console.warn('[portal-sync] auto sync failed', {
          reason,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [onSynced, user]
  );

  useEffect(() => {
    void runAutoSync('app_open');
  }, [runAutoSync]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void runAutoSync('periodic');
    }, AUTO_SYNC_CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [runAutoSync]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void runAutoSync('tab_visible');
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [runAutoSync]);

  return { runAutoSync };
}
