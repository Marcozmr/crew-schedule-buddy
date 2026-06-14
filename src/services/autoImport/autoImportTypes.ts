import type { RosterHeader, RosterEntry } from '@/lib/pdf-import';

export type AirlineId = 'LATAM' | 'GOL' | 'AZUL' | 'GENERIC';

export type AutoImportStatus =
  | 'idle'
  | 'opening_portal'
  | 'waiting_login'
  | 'login_detected'
  | 'searching_roster'
  | 'roster_found'
  | 'importing'
  | 'comparing'
  | 'completed'
  | 'error'
  | 'fallback_manual';

export const AUTO_IMPORT_STATUS_LABELS: Record<AutoImportStatus, string> = {
  idle: 'Aguardando',
  opening_portal: 'Abrindo portal',
  waiting_login: 'Aguardando login',
  login_detected: 'Login detectado — importe o PDF da escala abaixo',
  searching_roster: 'Buscando escala',
  roster_found: 'Escala encontrada',
  importing: 'Importando',
  comparing: 'Comparando alterações',
  completed: 'Importação concluída',
  error: 'Não foi possível importar automaticamente. Use a importação manual.',
  fallback_manual: 'Importação manual necessária',
};

export type RosterChangeType =
  | 'flight_added'
  | 'flight_removed'
  | 'time_changed'
  | 'report_time_changed'
  | 'origin_changed'
  | 'destination_changed'
  | 'overnight_changed'
  | 'day_off_changed'
  | 'reserve_changed';

export interface RosterChange {
  type: RosterChangeType;
  date: string;
  description: string;
}

export interface NormalizedRoster {
  header: RosterHeader | null;
  entries: RosterEntry[];
  rawText: string;
  sourceAirline: AirlineId;
  importedAt: string;
}

export interface AirlineConnector {
  airline: AirlineId;
  loginUrl: string;
  detectLoginSuccess(url: string, html?: string): boolean;
  detectRosterPage(url: string, html?: string): boolean;
  extractRoster(input: {
    html?: string;
    text?: string;
    pdfFile?: File;
    pdfArrayBuffer?: ArrayBuffer;
    currentUrl?: string;
  }): Promise<NormalizedRoster>;
}

export interface AutoImportResult {
  success: boolean;
  rosterId: string | null;
  insertedCount: number;
  parsedCount: number;
  changes: RosterChange[];
  error: string | null;
  status: AutoImportStatus;
}

export interface AutoImportState {
  status: AutoImportStatus;
  airline: AirlineId | null;
  error: string | null;
  changes: RosterChange[];
  rosterId: string | null;
}

export const INITIAL_AUTO_IMPORT_STATE: AutoImportState = {
  status: 'idle',
  airline: null,
  error: null,
  changes: [],
  rosterId: null,
};
