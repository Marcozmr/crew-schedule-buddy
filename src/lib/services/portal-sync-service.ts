import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { getPortalConnectorDefinition } from '@/lib/portal/connectors';
import { clearPortalSession, readPortalSession } from '@/lib/portal/webview-connector';
import {
  PRIMARY_PORTAL_CONNECTOR_KEY,
  type PortalAuthRequest,
  type PortalConnectionRecord,
  type PortalConnectorKey,
  type PortalConnectionStatus,
  type PortalSyncExecutionResult,
  type PortalSyncRunRecord,
} from '@/lib/portal/types';

const nowIso = () => new Date().toISOString();

type PortalConnectionRow = Tables<'portal_connections'>;
type PortalSyncRunRow = Tables<'portal_sync_runs'>;
type PortalConnectionPayload = Partial<TablesInsert<'portal_connections'>> & {
  metadata?: Record<string, unknown> | null;
};

function normalizeConnection(row: PortalConnectionRow): PortalConnectionRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    connector_key: row.connector_key as PortalConnectorKey,
    display_name: row.display_name,
    connection_status: row.connection_status as PortalConnectionStatus,
    sync_enabled: row.sync_enabled,
    source_kind: row.source_kind as PortalConnectionRecord['source_kind'],
    connected_at: row.connected_at,
    disconnected_at: row.disconnected_at,
    last_synced_at: row.last_synced_at,
    last_successful_sync_at: row.last_successful_sync_at,
    session_expires_at: row.session_expires_at,
    last_error: row.last_error,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeRun(row: PortalSyncRunRow): PortalSyncRunRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    connection_id: row.connection_id,
    connector_key: row.connector_key as PortalConnectorKey,
    run_status: row.run_status as PortalSyncRunRecord['run_status'],
    trigger_type: row.trigger_type,
    source_kind: row.source_kind as PortalSyncRunRecord['source_kind'],
    started_at: row.started_at,
    completed_at: row.completed_at,
    roster_id: row.roster_id,
    imported_count: row.imported_count,
    parsed_count: row.parsed_count,
    error_message: row.error_message,
    details: (row.details as Record<string, unknown> | null) ?? null,
  };
}

async function upsertConnection(userId: string, payload: PortalConnectionPayload) {
  const connector = getPortalConnectorDefinition(PRIMARY_PORTAL_CONNECTOR_KEY);

  const { data, error } = await supabase
    .from('portal_connections')
    .upsert(
      {
        user_id: userId,
        connector_key: PRIMARY_PORTAL_CONNECTOR_KEY,
        display_name: 'Portal',
        source_kind: connector.sourceKind,
        ...payload,
        metadata: payload.metadata ?? {},
      },
      { onConflict: 'user_id,connector_key' },
    )
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Não foi possível atualizar a conexão do portal.');
  }

  return normalizeConnection(data);
}

export async function getPortalConnection(userId: string) {
  const { data } = await supabase
    .from('portal_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('connector_key', PRIMARY_PORTAL_CONNECTOR_KEY)
    .maybeSingle();

  return data ? normalizeConnection(data) : null;
}

export async function ensurePortalConnection(userId: string) {
  const existing = await getPortalConnection(userId);
  if (existing) return existing;

  return upsertConnection(userId, {
    connection_status: 'disconnected',
    sync_enabled: false,
  });
}

export async function listRecentPortalSyncRuns(userId: string) {
  const { data } = await supabase
    .from('portal_sync_runs')
    .select('*')
    .eq('user_id', userId)
    .eq('connector_key', PRIMARY_PORTAL_CONNECTOR_KEY)
    .order('started_at', { ascending: false })
    .limit(5);

  return (data ?? []).map(normalizeRun);
}

export async function preparePortalConnection(userId: string): Promise<PortalAuthRequest> {
  await upsertConnection(userId, {
    connection_status: 'pending',
    sync_enabled: true,
    disconnected_at: null,
    last_error: null,
    metadata: {
      provider: PRIMARY_PORTAL_CONNECTOR_KEY,
      auth_mode: 'browser_managed_session',
      login_domain: 'login.microsoftonline.com',
    },
  });

  const connector = getPortalConnectorDefinition(PRIMARY_PORTAL_CONNECTOR_KEY);
  return connector.beginAuth();
}

export async function markPortalConnectedFromWebView(userId: string, lastObservedUrl: string | null = null) {
  const session = readPortalSession();

  return upsertConnection(userId, {
    connection_status: 'connected',
    sync_enabled: true,
    connected_at: nowIso(),
    disconnected_at: null,
    session_expires_at: null,
    last_error: null,
    metadata: {
      provider: session?.provider ?? PRIMARY_PORTAL_CONNECTOR_KEY,
      auth_mode: session?.sessionMode ?? 'browser_managed',
      login_domain: session?.loginDomain ?? 'login.microsoftonline.com',
      last_observed_url: lastObservedUrl ?? session?.lastObservedUrl ?? null,
      session_persisted_locally: Boolean(session),
    },
  });
}

export async function disconnectPortalConnection(userId: string) {
  clearPortalSession();

  return upsertConnection(userId, {
    connection_status: 'disconnected',
    sync_enabled: false,
    disconnected_at: nowIso(),
    session_expires_at: nowIso(),
    last_error: null,
    metadata: {
      provider: PRIMARY_PORTAL_CONNECTOR_KEY,
      auth_mode: 'browser_managed_session',
      disconnected_by_user: true,
    },
  });
}

async function createSyncRun(userId: string, connectionId: string) {
  const { data, error } = await supabase
    .from('portal_sync_runs')
    .insert({
      user_id: userId,
      connection_id: connectionId,
      connector_key: PRIMARY_PORTAL_CONNECTOR_KEY,
      run_status: 'pending',
      trigger_type: 'manual',
      source_kind: getPortalConnectorDefinition().sourceKind,
      details: {
        stage: 'connection_only',
      },
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Não foi possível iniciar a sincronização.');
  }

  return normalizeRun(data);
}

async function updateSyncRun(runId: string, payload: TablesUpdate<'portal_sync_runs'>) {
  await supabase.from('portal_sync_runs').update(payload).eq('id', runId);
}

export async function syncPortalConnection(args: { userId: string }) {
  const connection = await ensurePortalConnection(args.userId);
  const run = await createSyncRun(args.userId, connection.id);
  const connector = getPortalConnectorDefinition(connection.connector_key);
  const localSession = readPortalSession();

  const execution: PortalSyncExecutionResult = localSession
    ? await connector.sync({ userId: args.userId })
    : {
        status: 'expired',
        importedCount: 0,
        parsedCount: 0,
        rosterId: null,
        error: 'Sessão do portal não encontrada neste dispositivo. Conecte novamente para continuar.',
      };

  const completedAt = nowIso();
  const runStatus = execution.status === 'expired' ? 'error' : execution.status;

  await updateSyncRun(run.id, {
    run_status: runStatus,
    completed_at: completedAt,
    roster_id: execution.rosterId,
    imported_count: execution.importedCount,
    parsed_count: execution.parsedCount,
    error_message: execution.error ?? null,
    details: {
      reason: execution.reason ?? null,
      stage: 'connection_only',
    },
  });

  const updatedConnection = await upsertConnection(args.userId, {
    connection_status: execution.status === 'expired' ? 'expired' : 'connected',
    sync_enabled: execution.status !== 'expired',
    last_synced_at: execution.status === 'success' ? completedAt : connection.last_synced_at,
    last_successful_sync_at: execution.status === 'success' ? completedAt : connection.last_successful_sync_at,
    session_expires_at: execution.status === 'expired' ? completedAt : null,
    last_error: execution.status === 'expired' ? execution.error ?? null : null,
    metadata: {
      ...(connection.metadata ?? {}),
      provider: PRIMARY_PORTAL_CONNECTOR_KEY,
      auth_mode: 'browser_managed_session',
      sync_stage: 'connection_only',
    },
  });

  return {
    connection: updatedConnection,
    execution,
  };
}
