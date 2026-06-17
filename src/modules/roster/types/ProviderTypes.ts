/**
 * Tipos e contratos para providers de escala.
 * Arquitetura desacoplada para integração corporativa futura.
 */

export type RosterProviderId =
  | 'pdf'
  | 'manual'
  | 'corporate_portal'
  | 'iflight'
  /** GOL — sistema CrewLink/IADP (portal e-Component) */
  | 'gol'
  /** Azul — sistema CAE (Crew Activity Engine) */
  | 'azul'
  /** ABX Air — sistema CrewLink/IADP */
  | 'abx';

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'authenticated'
  | 'syncing'
  | 'expired'
  | 'failed'
  | 'unavailable';

export interface ConnectionResult {
  success: boolean;
  error?: string | null;
}

export interface ProviderStatus {
  status: ConnectionStatus;
  lastSyncAt?: string | null;
  error?: string | null;
  message?: string;
}

export interface RosterSyncResult {
  success: boolean;
  rosterId: string | null;
  parsedCount: number;
  insertedCount: number;
  error: string | null;
}

export interface RosterSourceInfo {
  id: RosterProviderId;
  displayName: string;
  description: string;
  available: boolean;
  comingSoonMessage?: string;
}

export interface RosterProvider {
  readonly id: RosterProviderId;
  readonly name: string;

  connect(): Promise<ConnectionResult>;
  disconnect(): Promise<void>;
  getStatus(): Promise<ProviderStatus>;

  syncRoster(): Promise<RosterSyncResult>;
  importRoster?(input?: File | unknown): Promise<RosterSyncResult>;

  supportsAutoSync(): boolean;
  supportsManualImport(): boolean;

  listAvailableSources(): RosterSourceInfo[];
}
