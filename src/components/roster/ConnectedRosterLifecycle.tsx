import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ConnectedRosterAutoUpdateService } from '@/modules/roster/services/ConnectedRosterAutoUpdateService';
import { autoSyncPortal } from '@/modules/device-portal/auto-sync';

const PERIODIC_CHECK_MS = 15 * 60_000;

/**
 * Registra ciclo de vida do app: login, foco e retorno do background — verificação leve com o backend
 * e, no app instalado, leitura automática do iFlight quando a última tem mais de 3 horas.
 */
export function ConnectedRosterLifecycle() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const run = () => {
      void ConnectedRosterAutoUpdateService.runLightUpdateCheck(user.id, { force: false });
      void autoSyncPortal(user.id).catch(() => undefined);
    };

    run();

    const onVis = () => {
      if (document.visibilityState === 'visible') run();
    };
    const onFocus = () => run();

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    // App aberto e parado (ex.: um aparelho que fica ligado sincronizando): verifica a cada 15 min.
    // A leitura do iFlight em si só acontece quando a última tem mais de 3 h (autoSyncPortal decide).
    const tick = window.setInterval(() => {
      void autoSyncPortal(user.id).catch(() => undefined);
    }, PERIODIC_CHECK_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(tick);
    };
  }, [user]);

  return null;
}
