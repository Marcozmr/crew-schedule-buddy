/**
 * Tipos de dados de roster e escala.
 */

export interface ActiveRosterInfo {
  id: string;
  providerId: string;
  lastSyncAt: string | null;
  syncStatus: 'pending' | 'success' | 'error';
}

export type SourceType = 'pdf' | 'manual' | 'corporate_portal' | 'iflight';
