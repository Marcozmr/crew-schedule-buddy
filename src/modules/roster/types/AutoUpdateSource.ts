/**
 * Prioridades de fonte para atualização automática (arquitetura futura).
 * Plataforma atual: importação manual/autorizada de PDF oficial pelo usuário.
 */

export type AutoUpdateSourceKind =
  | 'official_pdf_upload'
  | 'shared_inbox'
  | 'authorized_directory'
  | 'enterprise_connector';

export interface AutoUpdateSourceDescriptor {
  kind: AutoUpdateSourceKind;
  /** Menor = maior prioridade */
  priority: number;
  labelPt: string;
  /** Implementado no produto atual */
  implemented: boolean;
}

export const AUTO_UPDATE_SOURCE_CATALOG: AutoUpdateSourceDescriptor[] = [
  { kind: 'official_pdf_upload', priority: 1, labelPt: 'Último PDF oficial (CrewRosterReport*)', implemented: true },
  { kind: 'shared_inbox', priority: 2, labelPt: 'Arquivo compartilhado com o app', implemented: false },
  { kind: 'authorized_directory', priority: 3, labelPt: 'Diretório/pasta autorizada', implemented: false },
  { kind: 'enterprise_connector', priority: 4, labelPt: 'Conector enterprise autorizado', implemented: false },
];
