import { useEffect, useRef } from 'react';
import { postLatamConnect, postLatamSync } from '@/lib/roster-automation-api';
import { decideLatamAutomationKick } from '@/lib/roster/automation-ui-phase';
import type { AutomationRunRow, AutomationSessionRow } from '@/lib/roster/automation-types';
import { reportUnexpectedError } from '@/lib/monitoring/errorReporting';

export interface LatamAutomationBootstrapParams {
  /** Utilizador na área de escala corporativa / automação configurada. */
  enabled: boolean;
  getAccessToken: () => Promise<string | null>;
  session: AutomationSessionRow | null;
  latestRun: AutomationRunRow | null;
  /** Enquanto true, não dispara novo kick (ex.: carregamento inicial da tabela). */
  dataLoading: boolean;
  /** Erro ao ler tabelas — não tentar API. */
  schemaError: boolean;
  /** Incrementar para permitir novo pedido após "Tentar novamente". */
  retryNonce?: number;
}

/**
 * Inicia ou retoma automação no servidor (Chromium + pipeline SAB/iFlight/PDF).
 * Não depende do “portal conectado” no WebView da app — o login ocorre na janela do worker.
 */
export function useLatamAutomationBootstrap(params: LatamAutomationBootstrapParams): void {
  const {
    enabled,
    getAccessToken,
    session,
    latestRun,
    dataLoading,
    schemaError,
    retryNonce = 0,
  } = params;

  const lastKickKey = useRef<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    lastKickKey.current = null;
  }, [retryNonce]);

  useEffect(() => {
    if (!enabled || dataLoading || schemaError) return;

    const kick = decideLatamAutomationKick(session, latestRun);
    if (!kick) return;

    const key = `${kick.action}:${session?.id ?? 'none'}:${latestRun?.id ?? 'none'}:${session?.status ?? ''}`;
    if (lastKickKey.current === key) return;

    if (inFlight.current) return;
    inFlight.current = true;

    void (async () => {
      try {
        if (kick.action === 'connect') {
          await postLatamConnect(getAccessToken);
        } else {
          const sid = session?.id;
          if (!sid) {
            inFlight.current = false;
            return;
          }
          await postLatamSync(getAccessToken, sid);
        }
        lastKickKey.current = key;
        if (import.meta.env.DEV) {
          console.info('[roster-automation] bootstrap ok', kick.action, key);
        }
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[useLatamAutomationBootstrap]', e);
        }
        reportUnexpectedError(e, {
          flow: 'roster_automation_bootstrap',
          extra: { action: kick.action, sessionStatus: session?.status },
        });
      } finally {
        inFlight.current = false;
      }
    })();
  }, [enabled, dataLoading, schemaError, getAccessToken, session, latestRun, retryNonce]);
}
