/** Textos da tela guiada "Conectar sua escala" (onboarding). */

export const CONNECT_ROSTER_ONBOARDING = {
  pageTitle: 'Conectar sua escala',
  intro:
    'Em poucos passos você conecta a escala oficial ao EscalaX. O app não acessa o portal por você: você faz login no ambiente da empresa e depois traz o PDF para cá.',
  steps: [
    'Fazer login no portal LATAM',
    'Abrir o sistema SAB',
    'Abrir sua escala no iFlight',
    'Importar o CrewRosterReport',
  ],
  hintStep1: 'Use o botão abaixo para abrir o portal em uma nova janela.',
  hintStep2: 'No portal, abra o SAB (menu da empresa).',
  hintStep3: 'No iFlight, visualize sua escala no formato CrewRoster.',
  hintStep4: 'Baixe ou use o PDF CrewRosterReport e importe aqui.',
  waitingMessage:
    'Acesse o portal LATAM, entre no SAB e abra sua escala no iFlight. Depois volte ao EscalaX para concluir a conexão.',
  waitingPulse: 'Aguardando você abrir sua escala…',
  readyToImport: 'Quando estiver com o PDF da escala em mãos, importe abaixo para ativar no app.',
  actionsTitle: 'O que fazer agora',
  openPortal: 'Abrir portal LATAM',
  openedIFlight: 'Já abri minha escala',
  importPdf: 'Importar CrewRosterReport',
  backDashboard: 'Voltar ao dashboard',
  portalNotConfigured: 'URL do portal não configurada — você ainda pode importar o PDF manualmente com o botão acima.',
  successTitle: 'Escala conectada com sucesso.',
  successDescription: 'Redirecionando para o painel principal.',
} as const;
