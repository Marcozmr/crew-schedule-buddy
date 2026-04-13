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

/** Quando o serviço de automação (Playwright) está configurado — fluxo ponta a ponta no servidor. */
export const CONNECT_ROSTER_AUTOMATION = {
  intro:
    'Autentique uma vez no portal corporativo na janela segura do servidor. Em seguida o EscalaX acede ao SAB, ao iFlight e importa o CrewRosterReport automaticamente — sem baixar PDF manualmente como passo principal.',
  steps: [
    'Conectar ao portal (sessão segura no servidor)',
    'Portal SAB e iFlight abertos pela automação',
    'CrewRosterReport localizado e importado',
    'Escala ativa e sincronizada no EscalaX',
  ],
  hintStep1: 'Toque em “Conectar portal corporativo” na área de estado abaixo (ou aguarde se já houver sessão).',
  hintStep2: 'A automação navega até à sua escala oficial.',
  hintStep3: 'O PDF é obtido e aplicado ao seu perfil sem precisar de upload manual.',
  hintStep4: 'Nas próximas vezes, a sincronização pode repetir-se sozinha enquanto a sessão for válida.',
  waitingMessage: 'A sincronização oficial está em curso no servidor.',
  waitingPulse: 'A processar…',
  readyToImport: 'A importação manual de PDF fica disponível só como contingência, abaixo.',
  automationNote:
    'O fluxo principal é 100% automático após o login. O portal no seu browser (se abrir) serve apenas para consulta — não é necessário para importar a escala.',
} as const;
