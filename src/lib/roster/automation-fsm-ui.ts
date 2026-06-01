/**
 * Copy PT-BR para estados FSM da automação LATAM (espelha o worker).
 */
import type { CorporateFsmStateUi } from './automation-types';

export const AUTOMATION_FSM_LABELS: Record<
  CorporateFsmStateUi,
  { title: string; detail: string | null }
> = {
  idle: { title: 'Aguardando', detail: null },
  starting: { title: 'Iniciando conexão segura', detail: 'Preparando o ambiente no servidor.' },
  opening_corporate_portal: {
    title: 'Abrindo portal corporativo',
    detail: 'Carregando o ambiente LATAM para autenticação.',
  },
  waiting_sso: {
    title: 'Aguardando autenticação',
    detail: 'Complete o login (Microsoft, Google ou SSO) na janela do servidor — o fluxo retoma sozinho.',
  },
  authenticated: {
    title: 'Autenticação concluída',
    detail: 'Sessão válida — a seguir: Portal SAB e iFlight.',
  },
  opening_portal_sab: {
    title: 'Acessando Portal SAB',
    detail: 'Abrindo o hub de aplicações (incl. iFlightNeo).',
  },
  opening_iflight: {
    title: 'Acessando iFlight Neo',
    detail: 'Abrindo o ambiente de escala autorizado.',
  },
  locating_roster: {
    title: 'Localizando escala',
    detail: 'À espera do ecrã de roster/calendário no iFlight.',
  },
  downloading_report: {
    title: 'Baixando CrewRosterReport',
    detail: 'A iniciar o download do PDF oficial.',
  },
  importing_report: {
    title: 'Importando escala',
    detail: 'A processar o PDF e aplicar na sua conta.',
  },
  completed: { title: 'Concluído', detail: 'Fluxo terminado com sucesso.' },
  needs_user_interaction: {
    title: 'Ação necessária',
    detail: 'É preciso concluir um passo manual ou voltar a autenticar.',
  },
  failed: { title: 'Falha na automação', detail: null },
};

export function labelForFsm(fsm: string | null | undefined): { title: string; detail: string | null } | null {
  if (!fsm) return null;
  const k = fsm as CorporateFsmStateUi;
  return AUTOMATION_FSM_LABELS[k] ?? { title: 'Em progresso', detail: null };
}
