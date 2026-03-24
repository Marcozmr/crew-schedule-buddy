/**
 * Classe base abstrata para RosterProvider.
 * Contrato desacoplado para qualquer fonte de escala.
 */

import type {
  RosterProvider as IRosterProvider,
  RosterProviderId,
  ConnectionResult,
  ProviderStatus,
  RosterSyncResult,
  RosterSourceInfo,
} from '../types';

export abstract class RosterProvider implements IRosterProvider {
  abstract readonly id: RosterProviderId;
  abstract readonly name: string;

  abstract connect(): Promise<ConnectionResult>;
  abstract disconnect(): Promise<void>;
  abstract getStatus(): Promise<ProviderStatus>;
  abstract listAvailableSources(): RosterSourceInfo[];

  supportsAutoSync(): boolean {
    return false;
  }

  supportsManualImport(): boolean {
    return false;
  }

  async syncRoster(): Promise<RosterSyncResult> {
    return { success: false, rosterId: null, parsedCount: 0, insertedCount: 0, error: 'Não suportado' };
  }

  async importRoster?(_input?: File | unknown): Promise<RosterSyncResult> {
    return { success: false, rosterId: null, parsedCount: 0, insertedCount: 0, error: 'Não suportado' };
  }
}
