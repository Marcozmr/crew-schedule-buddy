/**
 * AbxProvider — ABX Air, sistema CrewLink/IADP.
 *
 * ABX Air usa o mesmo sistema CrewLink/IADP que a GOL.
 * Motor de automação backend em desenvolvimento.
 * Provider registrado na arquitetura; conector ficará disponível em breve.
 */

import { RosterProvider } from './RosterProvider';
import type { ConnectionResult, ProviderStatus, RosterSourceInfo, RosterSyncResult } from '../types';

export class AbxProvider extends RosterProvider {
  readonly id = 'abx' as const;
  readonly name = 'ABX Air — CrewLink/IADP';

  async connect(): Promise<ConnectionResult> {
    return { success: false, error: 'Conector ABX Air em desenvolvimento — disponível em breve' };
  }

  async disconnect(): Promise<void> {
    // noop — não há sessão activa
  }

  async getStatus(): Promise<ProviderStatus> {
    return {
      status: 'unavailable',
      message: 'Conector ABX Air (CrewLink/IADP) em desenvolvimento',
    };
  }

  async syncRoster(): Promise<RosterSyncResult> {
    return { success: false, rosterId: null, parsedCount: 0, insertedCount: 0, error: 'Indisponível' };
  }

  supportsAutoSync(): boolean { return false; }
  supportsManualImport(): boolean { return false; }

  listAvailableSources(): RosterSourceInfo[] {
    return [
      {
        id: 'abx',
        displayName: 'ABX Air — CrewLink/IADP',
        description: 'Importação automática via sistema CrewLink/IADP — em breve',
        available: false,
        comingSoonMessage: 'Conector em desenvolvimento',
      },
    ];
  }
}
