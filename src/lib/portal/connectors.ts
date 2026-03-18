import type { PortalConnectorDefinition, PortalConnectorKey } from '@/lib/portal/types';
import { PRIMARY_PORTAL_CONNECTOR_KEY } from '@/lib/portal/types';

const LATAM_PORTAL_ENTRY_URL = 'https://portal.latam.com';

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
    loginUrl: LATAM_PORTAL_ENTRY_URL,
    loginDomains: ['login.microsoftonline.com'],
    successDomains: ['portal.latam.com'],
    portalLabel: 'Portal LATAM',
    successHint: 'Abra o portal oficial, conclua o login SSO com MFA se necessário e aguarde o retorno ao portal autenticado.',
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
