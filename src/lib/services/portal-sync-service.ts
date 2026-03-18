import { supabase } from '@/integrations/supabase/client';
import { getPortalConnectorDefinition } from '@/lib/portal/connectors';
import {
  PRIMARY_PORTAL_CONNECTOR_KEY,
  PROVIDER_TOKEN_STORAGE_KEY,
  type PortalConnectionRecord,
  type PortalConnectorKey,
  type PortalConnectionStatus,
  type PortalSyncExecutionResult,
  type PortalSyncRunRecord,
} from '@/lib/portal/types';

const nowIso = () => new Date().toISOString();

function normalizeConnection(row: Record<string, unknown>): PortalConnectionRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    connector_key: row.connector_key as PortalConnectorKey,
    display_name: String(row.display_name ?? 'Portal'),
    connection_status: (row.connection_status as PortalConnectionStatus) ?? 'disconnected',
    sync_enabled: Boolean(row.sync_enabled),
    source_kind: (row.source_kind as PortalConnectionRecord['source_kind']) ?? 'official_pdf',
    connected_at: (row.connected_at as string | null) ?? null,
    disconnected_at: (row.disconnected_at as string | null) ?? null,
    last_synced_at: (row.last_synced_at as string | null) ?? null,
    last_successful_sync_at: (row.last_successful_sync_at as string | null) ?? null,
    session_expires_at: (row.session_expires_at as string | null) ?? null,
    last_error: (row.last_error as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

function normalizeRun(row: Record<string, unknown>): PortalSyncRunRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    connection_id: String(row.connection_id),
    connector_key: row.connector_key as PortalConnectorKey,
    run_status: row.run_status as PortalSyncRunRecord['run_status'],
    trigger_type: String(row.trigger_type ?? 'manual'),
    source_kind: row.source_kind as PortalSyncRunRecord['source_kind'],
    started_at: String(row.started_at ?? ''),
    completed_at: (row.completed_at as string | null) ?? null,
    roster_id: (row.roster_id as string | null) ?? null,
    imported_count: Number(row.imported_count ?? 0),
    parsed_count: Number(row.parsed_count ?? 0),
    error_message: (row.error_message as string | null) ?? null,
    details: (row.details as Record<string, unknown> | null) ?? null,
  };
}

async function upsertConnection(userId: string, payload: Record<string, unknown>) {
  const connector = getPortalConnectorDefinition(PRIMARY_PORTAL_CONNECTOR_KEY);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('portal_connections') as any)
    .upsert({
      user_id: userId,
      connector_key: PRIMARY_PORTAL_CONNECTOR_KEY,
      display_name: 'Portal',
      source_kind: connector.sourceKind,
      ...payload,
    }, { onConflict: 'user_id,connector_key' })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Não foi possível atualizar a conexão do portal.');
  }

  return normalizeConnection(data as Record<string, unknown>);
}

export async function getPortalConnection(userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('portal_connections') as any)
    .select('*')
    .eq('user_id', userId)
    .eq('connector_key', PRIMARY_PORTAL_CONNECTOR_KEY)
    .maybeSingle();

  return data ? normalizeConnection(data as Record<string, unknown>) : null;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('portal_sync_runs') as any)
    .select('*')
    .eq('user_id', userId)
    .eq('connector_key', PRIMARY_PORTAL_CONNECTOR_KEY)
    .order('started_at', { ascending: false })
    .limit(5);

  return ((data ?? []) as Array<Record<string, unknown>>).map(normalizeRun);
}

export async function startPortalConnection(userId: string) {
  await upsertConnection(userId, {
    connection_status: 'pending',
    sync_enabled: true,
    disconnected_at: null,
    last_error: null,
  });

  const connector = getPortalConnectorDefinition(PRIMARY_PORTAL_CONNECTOR_KEY);
  await connector.connect();
}

export async function markPortalConnectedFromSession(userId: string) {
  return upsertConnection(userId, {
    connection_status: 'connected',
    sync_enabled: true,
    connected_at: nowIso(),
    disconnected_at: null,
    session_expires_at: null,
    last_error: null,
  });
}

export async function disconnectPortalConnection(userId: string) {
  localStorage.removeItem(PROVIDER_TOKEN_STORAGE_KEY);

  return upsertConnection(userId, {
    connection_status: 'disconnected',
    sync_enabled: false,
    disconnected_at: nowIso(),
    session_expires_at: nowIso(),
    last_error: null,
  });
}

async function createSyncRun(userId: string, connectionId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('portal_sync_runs') as any)
    .insert({
      user_id: userId,
      connection_id: connectionId,
      connector_key: PRIMARY_PORTAL_CONNECTOR_KEY,
      run_status: 'pending',
      trigger_type: 'manual',
      source_kind: getPortalConnectorDefinition().sourceKind,
      details: {},
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Não foi possível iniciar a sincronização.');
  }

  return normalizeRun(data as Record<string, unknown>);
}

async function updateSyncRun(runId: string, payload: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('portal_sync_runs') as any)
    .update(payload)
    .eq('id', runId);
}

async function tagSyncedRoster(rosterId: string | null, connectionId: string) {
  if (!rosterId) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('imported_rosters') as any)
    .update({
      import_origin: 'portal_sync',
      connector_key: PRIMARY_PORTAL_CONNECTOR_KEY,
      synced_at: nowIso(),
      portal_connection_id: connectionId,
    })
    .eq('id', rosterId);
}

export async function syncPortalConnection(args: { userId: string; providerToken: string | null }) {
  const connection = await ensurePortalConnection(args.userId);
  const run = await createSyncRun(args.userId, connection.id);
  const connector = getPortalConnectorDefinition(connection.connector_key);

  const execution: PortalSyncExecutionResult = await connector.sync({
    userId: args.userId,
    providerToken: args.providerToken,
  });

  await tagSyncedRoster(execution.rosterId, connection.id);

  const completedAt = nowIso();
  const runStatus = execution.status === 'expired' ? 'error' : execution.status;

  await updateSyncRun(run.id, {
    run_status: runStatus,
    completed_at: completedAt,
    roster_id: execution.rosterId,
    imported_count: execution.importedCount,
    parsed_count: execution.parsedCount,
    error_message: execution.error ?? null,
    details: execution.diagnostic ?? {},
  });

  const updatedConnection = await upsertConnection(args.userId, {
    connection_status: execution.status === 'expired' ? 'expired' : 'connected',
    sync_enabled: execution.status !== 'expired',
    last_synced_at: completedAt,
    last_successful_sync_at: execution.status === 'success' || execution.status === 'noop' ? completedAt : connection.last_successful_sync_at,
    session_expires_at: execution.status === 'expired' ? completedAt : null,
    last_error: execution.error ?? null,
  });

  return {
    connection: updatedConnection,
    execution,
  };
}
