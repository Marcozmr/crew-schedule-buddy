import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ConnectedRosterAutoUpdateService } from '@/modules/roster/services/ConnectedRosterAutoUpdateService';

/**
 * Registra ciclo de vida do app: login, foco e retorno do background — verificação leve com o backend.
 */
export function ConnectedRosterLifecycle() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const run = () => {
      void ConnectedRosterAutoUpdateService.runLightUpdateCheck(user.id, { force: false });
    };

    run();

    const onVis = () => {
      if (document.visibilityState === 'visible') run();
    };
    const onFocus = () => run();

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
  }, [user]);

  return null;
}
