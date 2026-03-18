import type { PortalConnectorDefinition, PortalConnectorKey } from '@/lib/portal/types';
import { PRIMARY_PORTAL_CONNECTOR_KEY } from '@/lib/portal/types';

const MICROSOFT_LOGIN_URL = 'https://login.microsoftonline.com/';

const plannedConnector = (key: Exclude<PortalConnectorKey, 'generic_sso'>): PortalConnectorDefinition => ({
  key,
  sourceKind: 'official_pdf',
  state: 'planned',
  beginAuth: async () => {
    throw new Error('Conexão indisponível no momento.');
  },
  sync: async () => ({
    status: 'error',
    importedCount: 0,
    parsedCount: 0,
    rosterId: null,
    error: 'Sincronização indisponível no momento.',
  }),
});

const genericSsoConnector: PortalConnectorDefinition = {
  key: 'generic_sso',
  sourceKind: 'authenticated_html',
  state: 'ready',
  beginAuth: async () => ({
    loginUrl: MICROSOFT_LOGIN_URL,
    loginDomain: 'login.microsoftonline.com',
    successHint: 'Conclua o login corporativo no portal oficial e volte ao EscalaX para confirmar a conexão.',
  }),
  sync: async () => ({
    status: 'noop',
    importedCount: 0,
    parsedCount: 0,
    rosterId: null,
    reason: 'Portal conectado. A sincronização automática da escala será ativada na próxima etapa.',
    error: null,
  }),
};

export const portalConnectorRegistry: Record<PortalConnectorKey, PortalConnectorDefinition> = {
  generic_sso: genericSsoConnector,
  latam_connector: plannedConnector('latam_connector'),
  gol_connector: plannedConnector('gol_connector'),
  azul_connector: plannedConnector('azul_connector'),
};

export function getPortalConnectorDefinition(key: PortalConnectorKey = PRIMARY_PORTAL_CONNECTOR_KEY) {
  return portalConnectorRegistry[key];
}
