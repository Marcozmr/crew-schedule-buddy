/** Mensagens de produto (português) — escala conectada e atualização */

export const ROSTER_UX_MESSAGES = {
  scaleConnected: 'Escala conectada',
  checkingUpdate: 'Verificando atualização da escala...',
  newOfficialFound: 'Nova escala oficial encontrada',
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
} as const;
