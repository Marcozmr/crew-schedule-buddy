import { lovable } from '@/integrations/lovable';
import { importScheduleFromGmail, isGmailScopeError } from '@/lib/gmail-import';
import type { PortalConnectorDefinition, PortalConnectorKey } from '@/lib/portal/types';
import { PRIMARY_PORTAL_CONNECTOR_KEY } from '@/lib/portal/types';

const GOOGLE_SCOPE = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
].join(' ');

const plannedConnector = (key: Exclude<PortalConnectorKey, 'latam_connector'>): PortalConnectorDefinition => ({
  key,
  sourceKind: 'official_pdf',
  state: 'planned',
  connect: async () => {
    throw new Error('Sincronização indisponível no momento.');
  },
  sync: async () => ({
    status: 'error',
    importedCount: 0,
    parsedCount: 0,
    rosterId: null,
    error: 'Sincronização indisponível no momento.',
  }),
});

const latamConnector: PortalConnectorDefinition = {
  key: 'latam_connector',
  sourceKind: 'official_pdf',
  state: 'ready',
  connect: async () => {
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: `${window.location.origin}/settings`,
      extraParams: {
        scope: GOOGLE_SCOPE,
        prompt: 'consent',
        access_type: 'offline',
        include_granted_scopes: 'true',
      },
    });

    if (result.error) {
      throw result.error;
    }
  },
  sync: async ({ userId, providerToken }) => {
    if (!providerToken) {
      return {
        status: 'expired',
        importedCount: 0,
        parsedCount: 0,
        rosterId: null,
        error: 'Sincronização indisponível. Conecte ao portal novamente.',
      };
    }

    try {
      const result = await importScheduleFromGmail(userId, providerToken, {
        searchQuery: 'has:attachment filename:pdf newer_than:180d',
        subjectContains: 'CrewRosterReport',
        senderContains: 'iFlight',
      });

      const computedError = result.parserError ?? result.diagnostic.final_error ?? null;
      if (computedError) {
        return {
          status: 'error',
          importedCount: result.importedCount,
          parsedCount: result.parsedCount,
          rosterId: result.rosterId ?? null,
          reason: result.reason,
          error: computedError,
          diagnostic: result.diagnostic,
        };
      }

      if (result.importedCount === 0) {
        return {
          status: 'noop',
          importedCount: 0,
          parsedCount: result.parsedCount,
          rosterId: result.rosterId ?? null,
          reason: result.reason ?? 'Sem novas alterações para sincronizar.',
          error: null,
          diagnostic: result.diagnostic,
        };
      }

      return {
        status: 'success',
        importedCount: result.importedCount,
        parsedCount: result.parsedCount,
        rosterId: result.rosterId ?? null,
        reason: result.reason,
        error: null,
        diagnostic: result.diagnostic,
      };
    } catch (error) {
      return {
        status: isGmailScopeError(error) ? 'expired' : 'error',
        importedCount: 0,
        parsedCount: 0,
        rosterId: null,
        error: isGmailScopeError(error)
          ? 'Sincronização indisponível. Reconecte o portal para restaurar o acesso.'
          : error instanceof Error
            ? error.message
            : 'Falha ao sincronizar o portal.',
      };
    }
  },
};

export const portalConnectorRegistry: Record<PortalConnectorKey, PortalConnectorDefinition> = {
  latam_connector: latamConnector,
  gol_connector: plannedConnector('gol_connector'),
  azul_connector: plannedConnector('azul_connector'),
};

export function getPortalConnectorDefinition(key: PortalConnectorKey = PRIMARY_PORTAL_CONNECTOR_KEY) {
  return portalConnectorRegistry[key];
}
