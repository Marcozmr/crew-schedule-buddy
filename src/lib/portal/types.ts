export const PORTAL_SESSION_STORAGE_KEY = 'portal_authenticated_session';
export const PROVIDER_TOKEN_STORAGE_KEY = 'google_provider_token';
export const PRIMARY_PORTAL_CONNECTOR_KEY = 'generic_sso' as const;

export type PortalConnectorKey = 'generic_sso' | 'latam_connector' | 'gol_connector' | 'azul_connector';
export type PortalConnectionStatus = 'connected' | 'pending' | 'disconnected' | 'unavailable' | 'expired';
export type PortalSyncRunStatus = 'pending' | 'success' | 'noop' | 'error';
export type PortalSourceKind = 'official_pdf' | 'authenticated_html' | 'authenticated_endpoint';
export type PortalConnectorState = 'ready' | 'planned';

export interface PortalSessionSnapshot {
  provider: 'generic_sso';
  connectedAt: string;
  lastObservedUrl: string | null;
  loginDomain: string;
  sessionMode: 'browser_managed';
}

export interface PortalAuthRequest {
  loginUrl: string;
  loginDomain: string;
  successHint: string;
}

export interface PortalConnectionRecord {
  id: string;
  user_id: string;
  connector_key: PortalConnectorKey;
  display_name: string;
  connection_status: PortalConnectionStatus;
  sync_enabled: boolean;
  source_kind: PortalSourceKind;
  connected_at: string | null;
  disconnected_at: string | null;
  last_synced_at: string | null;
  last_successful_sync_at: string | null;
  session_expires_at: string | null;
  last_error: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface PortalSyncRunRecord {
  id: string;
  user_id: string;
  connection_id: string;
  connector_key: PortalConnectorKey;
  run_status: PortalSyncRunStatus;
  trigger_type: string;
  source_kind: PortalSourceKind;
  started_at: string;
  completed_at: string | null;
  roster_id: string | null;
  imported_count: number;
  parsed_count: number;
  error_message: string | null;
  details: Record<string, unknown> | null;
}

export interface PortalSyncExecutionResult {
  status: PortalSyncRunStatus | 'expired';
  importedCount: number;
  parsedCount: number;
  rosterId: string | null;
  reason?: string;
  error?: string | null;
}

export interface PortalConnectorDefinition {
  key: PortalConnectorKey;
  sourceKind: PortalSourceKind;
  state: PortalConnectorState;
  beginAuth: () => Promise<PortalAuthRequest>;
  sync: (args: { userId: string }) => Promise<PortalSyncExecutionResult>;
}
