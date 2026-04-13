import type { AutomationRunRow, AutomationSessionRow } from './automation-types';
import {
  AUTOMATION_STATE_LABELS,
  deriveAutomationConnectionState,
  type AutomationConnectionState,
} from './automation-connection-state';
import { decideLatamAutomationKick, isAutomationRunInFlight, isSessionBusy } from './automation-orchestration';

/** Re-export para consumidores que importavam apenas de `automation-ui-phase`. */
export {
  decideLatamAutomationKick,
  isAutomationRunInFlight,
  isSessionBusy,
} from './automation-orchestration';

/** Fases amigáveis para UI (sem expor nomes internos de BD). */
export type AutomationUiPhase =
  | 'idle'
  | 'connecting'
  | 'searching'
  | 'importing'
  | 'success'
  | 'recoverable'
  | 'manual_fallback';

function fromConnectionState(conn: AutomationConnectionState): { title: string; detail: string | null } {
  const L = AUTOMATION_STATE_LABELS[conn];
  return { title: L.title, detail: L.detail ?? null };
}

export function mapAutomationToUiPhase(
  session: AutomationSessionRow | null,
  latestRun: AutomationRunRow | null,
): { phase: AutomationUiPhase; title: string; detail: string | null } {
  const st = session?.status;
  const runBusy = isAutomationRunInFlight(latestRun);
  const conn = deriveAutomationConnectionState(session, latestRun);

  if (st === 'roster_connected') {
    return {
      phase: 'success',
      title: 'Escala sincronizada',
      detail: 'Sua escala oficial foi importada e está ativa no EscalaX.',
    };
  }

  if (st === 'error' || st === 'reconnect_required') {
    const base = fromConnectionState(conn);
    return {
      phase: 'recoverable',
      title: base.title,
      detail: session?.last_error?.trim() || base.detail,
    };
  }

  if (runBusy || isSessionBusy(st)) {
    if (st === 'roster_importing' || latestRun?.status === 'roster_importing') {
      return {
        phase: 'importing',
        title: 'Importando escala automaticamente',
        detail: 'Processando o PDF oficial e aplicando na sua conta.',
      };
    }
    if (st === 'portal_connecting' || latestRun?.status === 'portal_connecting') {
      return {
        phase: 'connecting',
        title: 'Conectando ao portal corporativo',
        detail:
          'Verificando sessão — complete o login na janela do servidor, se solicitado. Depois o fluxo segue sozinho.',
      };
    }
    if (st === 'roster_downloading' || latestRun?.status === 'roster_downloading') {
      return {
        phase: 'searching',
        title: 'Localizando CrewRosterReport',
        detail: 'Abrindo o ambiente autorizado e obtendo o relatório oficial.',
      };
    }
    return {
      phase: 'searching',
      title: 'Acessando escala oficial',
      detail: 'Navegando no ambiente corporativo (SAB / iFlight) até o relatório.',
    };
  }

  if (st === 'portal_connected' && latestRun?.finished_at && latestRun.error_message) {
    return {
      phase: 'recoverable',
      title: 'Não foi possível concluir automaticamente',
      detail: 'A sessão foi guardada — pode tentar sincronizar novamente.',
    };
  }

  if (st === 'portal_connected' || st === 'disconnected') {
    const base = fromConnectionState(conn);
    return {
      phase: 'idle',
      title: base.title,
      detail: base.detail,
    };
  }

  return {
    phase: 'idle',
    title: 'Aguardando',
    detail: null,
  };
}

