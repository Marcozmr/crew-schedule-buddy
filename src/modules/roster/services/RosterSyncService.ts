/**
 * Roster Sync Engine — orquestração de sincronização e importação.
 * Seleção de provider, normalização, conflitos, gestão de roster ativo.
 */

import { ProviderRegistry } from './ProviderRegistry';
import { SessionManager } from './SessionManager';
import type { RosterProviderId, RosterSyncResult } from '../types';

export const RosterSyncService = {
  async importViaPdf(file: File): Promise<RosterSyncResult> {
    const provider = ProviderRegistry.getProviderById('pdf');
    const result = await provider.connect();
    if (!result.success) {
      return { success: false, rosterId: null, parsedCount: 0, insertedCount: 0, error: result.error ?? 'Falha ao conectar' };
    }
    try {
      const data = await provider.importRoster?.(file);
      if (data?.success && data.rosterId) {
        SessionManager.updateLastSync('pdf', new Date().toISOString());
      }
      return data ?? { success: false, rosterId: null, parsedCount: 0, insertedCount: 0, error: 'Não suportado' };
    } finally {
      await provider.disconnect();
    }
  },

  async importViaManual(text: string, fileName?: string): Promise<RosterSyncResult> {
    const provider = ProviderRegistry.getProviderById('manual');
    const result = await provider.connect();
    if (!result.success) {
      return { success: false, rosterId: null, parsedCount: 0, insertedCount: 0, error: result.error ?? 'Falha ao conectar' };
    }
    try {
      const data = await provider.importRoster?.({ text, fileName });
      if (data?.success && data.rosterId) {
        SessionManager.updateLastSync('manual', new Date().toISOString());
      }
      return data ?? { success: false, rosterId: null, parsedCount: 0, insertedCount: 0, error: 'Não suportado' };
    } finally {
      await provider.disconnect();
    }
  },

  getAvailableProviders() {
    return ProviderRegistry.getAvailableProviders();
  },

  getProviderById(id: RosterProviderId) {
    return ProviderRegistry.getProviderById(id);
  },

  getAllSources() {
    return ProviderRegistry.getAllSources();
  },

  async getProviderStatus(id: RosterProviderId) {
    return ProviderRegistry.getProviderById(id).getStatus();
  },

  getSession() {
    return SessionManager.get();
  },
};
