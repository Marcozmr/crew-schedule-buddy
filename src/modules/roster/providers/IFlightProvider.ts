/**
 * IFlightProvider — módulo operacional de escala (iFlight / IBS).
 * Depende da conexão ao portal LATAM. Integração futura de roster (autorizada).
 * NÃO implementa scraping, APIs privadas ou automação de login.
 */

import { SessionManager } from '../services/SessionManager';
import { corporatePortalConfig } from '@/lib/corporate-portal-config';
import { RosterProvider } from './RosterProvider';
import type { ConnectionResult, ProviderStatus, RosterSourceInfo, RosterSyncResult } from '../types';

export class IFlightProvider extends RosterProvider {
  readonly id = 'iflight' as const;
  readonly name = 'iFlight Crew System';

  async connect(): Promise<ConnectionResult> {
    if (!SessionManager.isCorporateConnected()) {
      return {
        success: false,
        error: 'Conecte o portal LATAM primeiro',
      };
    }
    return {
      success: false,
      error: 'Integração futura — use PDF ou importação manual por enquanto.',
    };
  }

  async disconnect(): Promise<void> {
    // Sem sessão própria no EscalaX
  }

  async getStatus(): Promise<ProviderStatus> {
    if (!corporatePortalConfig.iflightEnabled) {
      return { status: 'unavailable', message: 'Módulo iFlight não habilitado' };
    }

    const portalConnected = SessionManager.isCorporateConnected();

    if (!portalConnected) {
      return {
        status: 'unavailable',
        message: 'Conecte o portal LATAM primeiro',
      };
    }

    const moduleUrl = corporatePortalConfig.iflightModuleUrl;
    if (moduleUrl) {
      return {
        status: 'connected',
        message: 'Portal LATAM conectado — você pode abrir o módulo iFlight',
      };
    }

    return {
      status: 'connected',
      message: 'Portal conectado — módulo preparado para integração futura',
    };
  }

  async syncRoster(): Promise<RosterSyncResult> {
    if (!SessionManager.isCorporateConnected()) {
      return {
        success: false,
        rosterId: null,
        parsedCount: 0,
        insertedCount: 0,
        error: 'Conecte o portal LATAM primeiro',
      };
    }
    return {
      success: false,
      rosterId: null,
      parsedCount: 0,
      insertedCount: 0,
      error: 'Sincronização ainda não disponível. Use importação PDF ou manual.',
    };
  }

  supportsAutoSync(): boolean {
    return false;
  }

  supportsManualImport(): boolean {
    return false;
  }

  listAvailableSources(): RosterSourceInfo[] {
    const portalConnected = SessionManager.isCorporateConnected();
    const moduleUrl = corporatePortalConfig.iflightModuleUrl;

    if (!corporatePortalConfig.iflightEnabled) {
      return [
        {
          id: 'iflight',
          displayName: 'iFlight Crew System',
          description: 'Sistema operacional de escala',
          available: false,
          comingSoonMessage: 'Módulo não habilitado',
        },
      ];
    }

    if (!portalConnected) {
      return [
        {
          id: 'iflight',
          displayName: 'iFlight Crew System',
          description: 'Sistema operacional de escala',
          available: false,
          comingSoonMessage: 'Conecte o portal LATAM primeiro',
        },
      ];
    }

    return [
      {
        id: 'iflight',
        displayName: 'iFlight Crew System',
        description: 'Sistema operacional de escala',
        available: true,
        comingSoonMessage: moduleUrl ? 'Abrir módulo iFlight' : 'Módulo preparado para integração',
      },
    ];
  }
}
