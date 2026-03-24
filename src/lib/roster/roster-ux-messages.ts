/** Mensagens de produto (português) — escala conectada e atualização */

export const ROSTER_UX_MESSAGES = {
  scaleConnected: 'Escala conectada',
  /** Banner principal — título único após escala ativa */
  scaleConnectedBannerTitle: 'Escala conectada ✓',
  connectionStatusField: 'Status da conexão',
  checkingUpdate: 'Verificando atualização da escala...',
  newOfficialFound: 'Nova escala oficial encontrada',
  /** Novo PDF oficial substituiu a escala anterior */
  newCrewRosterDetected: 'Novo CrewRosterReport encontrado',
  scaleUpdatedSuccess: 'Escala atualizada com sucesso',
  scaleAlreadyUpToDate: 'Sua escala já está atualizada',
  lastUpdatedAt: (iso: string) => `Última atualização em ${iso}`,
  previousReplaced: 'Escala anterior substituída',
  scaleReady: 'Sua escala já está pronta no EscalaX',
  downloadingCurrent: 'Baixando escala atual...',
  downloadComplete: 'Download concluído',
  downloadUnavailable: 'Escala atual indisponível para download',
  downloadNoPdfInStorage: 'Escala atual indisponível para download (PDF não encontrado no armazenamento).',
  scaleAlreadyImported: 'Escala já importada (mesmo arquivo).',
  csvFallbackHint: 'Exportamos a escala em CSV (arquivo original não encontrável no armazenamento).',
  activeFileLabel: 'Arquivo ativo',
  /** Reforço de produto: escala como cache no servidor */
  scaleConnectedProductLine:
    'A última escala válida fica guardada para você — use o app no dia a dia sem passar pelo portal.',
} as const;

/** Fluxo corporativo LATAM → SAB → iFlight → CrewRosterReport (sem retorno automático do portal). */
export const CORPORATE_ROSTER_FLOW = {
  awaitingTitle: 'Faça login no portal, acesse o SAB e abra sua escala no iFlight.',
  awaitingLead:
    'O EscalaX não controla o login corporativo nem força o retorno do navegador ao app. Siga os passos abaixo e volte ao EscalaX para concluir — não dependemos de fechamento automático do portal.',
  awaitingStepLogin: 'Faça login no portal LATAM (Google ou método da empresa, se solicitado).',
  awaitingStepSab: 'Entre no SAB a partir do portal.',
  awaitingStepIFlight: 'Abra sua escala no iFlight e visualize o roster.',
  awaitingReturnHint:
    'Depois de abrir sua escala, volte ao EscalaX para concluir a conexão.',
  importPrimaryTitle: 'Importe o CrewRosterReport',
  importPrimaryLead:
    'Você já indicou que abriu sua escala no iFlight. Agora importe o PDF oficial (CrewRosterReport) para ativar a escala no EscalaX.',
  importPrimaryReassurance:
    'Após a primeira conexão, sua escala ficará disponível automaticamente nos próximos acessos.',
  dashboardHintCta: 'Continuar conexão da escala',
  voltar: 'Voltar',
} as const;
