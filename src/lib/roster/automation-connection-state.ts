import type { AutomationRunRow, AutomationSessionRow, AutomationSessionStatus } from './automation-types';

/**
 * Estados de produto para a conexão automática (mapeados a partir de `automation_sessions` / run).
 * Não persistidos em coluna própria — derivados para UI e copy.
 */
export type AutomationConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'session_valid'
  | 'syncing'
  | 'synced'
  | 'session_expired'
  | 'error';

export function deriveAutomationConnectionState(
  session: AutomationSessionRow | null,
  latestRun: AutomationRunRow | null,
): AutomationConnectionState {
  const st = session?.status;
  if (!session) return 'disconnected';
  if (st === 'roster_connected') return 'synced';
  if (st === 'reconnect_required') return 'session_expired';
  if (st === 'error') return 'error';
  if (st === 'portal_connecting' || latestRun?.status === 'portal_connecting') return 'connecting';
  if (
    st === 'iflight_detected' ||
    st === 'roster_downloading' ||
    st === 'roster_importing' ||
    latestRun?.status === 'roster_downloading' ||
    latestRun?.status === 'roster_importing'
  ) {
    return 'syncing';
  }
  if (st === 'disconnected') return 'disconnected';
  if (st === 'portal_connected') return 'session_valid';
  return 'syncing';
}

/** Rótulos curtos para progresso (PT-BR). */
export const AUTOMATION_STATE_LABELS: Record<AutomationConnectionState, { title: string; detail?: string }> = {
  disconnected: {
    title: 'Conectando ao portal corporativo',
    detail: 'Inicie a sincronização; o servidor abrirá o ambiente seguro para autenticação.',
  },
  connecting: {
    title: 'Verificando sessão',
    detail: 'Complete o login no portal na janela do servidor, se solicitado.',
  },
  session_valid: {
    title: 'Acessando escala oficial',
    detail: 'Sessão válida — a automação segue para o SAB e o iFlight.',
  },
  syncing: {
    title: 'Localizando e importando a escala',
    detail: 'Buscamos o CrewRosterReport e aplicamos no EscalaX.',
  },
  synced: {
    title: 'Escala sincronizada',
    detail: 'Sua escala oficial está ativa.',
  },
  session_expired: {
    title: 'Sessão expirada',
    detail: 'É necessário voltar a autenticar no portal.',
  },
  error: {
    title: 'Não foi possível concluir',
    detail: 'Tente novamente ou use a importação manual como contingência.',
  },
};

