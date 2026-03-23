import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { getPortalConnectorDefinition } from '@/lib/portal/connectors';
import { clearPortalSession, readPortalSession } from '@/lib/portal/webview-connector';
import { emitRosterUpdated } from '@/lib/events/roster-events';
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
const AUTO_SYNC_INTERVAL_MS = 10 * 60 * 1000;

type PortalConnectionRow = Tables<'portal_connections'>;
type PortalSyncRunRow = Tables<'portal_sync_runs'>;
type PortalConnectionPayload = Partial<TablesInsert<'portal_connections'>> & {
  metadata?: Record<string, unknown> | null;
} & Record<string, unknown>;

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
  const connector = getPortalConnectorDefinition(PRIMARY_PORTAL_CONNECTOR_KEY);
  const authRequest = await connector.beginAuth();

  await upsertConnection(userId, {
    connection_status: 'pending',
    sync_enabled: true,
    disconnected_at: null,
    last_error: null,
    metadata: {
      provider: PRIMARY_PORTAL_CONNECTOR_KEY,
      auth_mode: 'browser_managed_session',
      entry_url: authRequest.loginUrl,
      login_domains: authRequest.loginDomains,
      success_domains: authRequest.successDomains,
    },
  });

  return authRequest;
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
      entry_url: session?.portalEntryUrl ?? 'https://portal.latam.com',
      login_domains: session?.loginDomains ?? ['login.microsoftonline.com'],
      portal_domain: session?.portalDomain ?? 'portal.latam.com',
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
      entry_url: 'https://portal.latam.com',
    },
  });
}

async function createSyncRun(
  userId: string,
  connectionId: string,
  triggerType: 'manual' | 'auto' | 'auto_reconnect' = 'manual'
) {
  const { data, error } = await supabase
    .from('portal_sync_runs')
    .insert({
      user_id: userId,
      connection_id: connectionId,
      connector_key: PRIMARY_PORTAL_CONNECTOR_KEY,
      run_status: 'pending',
      trigger_type: triggerType,
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

async function applyPortalRosterPrecedence(args: { userId: string; rosterId: string; completedAt: string }) {
  const { userId, rosterId, completedAt } = args;

  // Desativa escalas ativas anteriores (campos mínimos — compatível sem colunas opcionais)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: previousActiveRows } = await (supabase.from('imported_rosters') as any)
    .update({
      is_active: false,
      updated_at: completedAt,
    })
    .eq('user_id', userId)
    .eq('is_active', true)
    .neq('id', rosterId)
    .select('id');

  const supersededIds = ((previousActiveRows as Array<{ id: string }> | null) ?? []).map((row) => row.id);

  if (supersededIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: supErr } = await (supabase.from('imported_rosters') as any)
      .update({ superseded_by: rosterId, roster_status: 'superseded' })
      .in('id', supersededIds);
    if (supErr) {
      console.warn('[portal-sync] optional superseded metadata skipped (run migrations)', supErr.message);
    }
  }

  // Ativa escala do portal — núcleo sempre suportado
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: actErr } = await (supabase.from('imported_rosters') as any)
    .update({
      is_active: true,
      import_origin: 'portal',
      synced_at: completedAt,
      import_status: 'success',
      import_error: null,
      updated_at: completedAt,
    })
    .eq('id', rosterId)
    .eq('user_id', userId);

  if (actErr) {
    console.error('[portal-sync] failed to activate portal roster', actErr.message);
    throw actErr;
  }

  // Opcional: colunas da migration de precedência (roster_source, roster_status, imported_at)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: metaErr } = await (supabase.from('imported_rosters') as any)
    .update({
      roster_source: 'portal',
      roster_status: 'active',
      imported_at: completedAt,
    })
    .eq('id', rosterId)
    .eq('user_id', userId);
  if (metaErr) {
    console.warn('[portal-sync] optional roster precedence columns skipped (apply migration)', metaErr.message);
  }
}

export async function syncPortalConnection(args: { userId: string }) {
  return syncPortalConnectionInternal({ ...args, triggerType: 'manual' });
}

async function syncPortalConnectionInternal(args: {
  userId: string;
  triggerType: 'manual' | 'auto' | 'auto_reconnect';
}) {
  const connection = await ensurePortalConnection(args.userId);
  const run = await createSyncRun(args.userId, connection.id, args.triggerType);
  const connector = getPortalConnectorDefinition(connection.connector_key);
  const localSession = readPortalSession();
  const syncStartedAt = nowIso();

  await upsertConnection(args.userId, {
    connection_status: 'syncing',
    sync_enabled: true,
    last_sync_attempt_at: syncStartedAt,
    sync_attempts: ((connection as unknown as { sync_attempts?: number }).sync_attempts ?? 0) + 1,
    sync_error: null,
    metadata: {
      ...(connection.metadata ?? {}),
      last_sync_trigger_type: args.triggerType,
      sync_stage: 'running',
    },
  });

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

  if (execution.status === 'success' && execution.rosterId) {
    await applyPortalRosterPrecedence({
      userId: args.userId,
      rosterId: execution.rosterId,
      completedAt,
    });

    emitRosterUpdated({
      userId: args.userId,
      reason: args.triggerType === 'auto' ? 'portal_sync_auto' : 'portal_sync_success',
      at: completedAt,
    });
  }

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
    connection_status:
      execution.status === 'expired'
        ? 'reconnect_required'
        : execution.status === 'success' || execution.status === 'noop'
          ? 'connected'
          : 'failed',
    sync_enabled: execution.status !== 'expired' && execution.status !== 'error',
    last_synced_at: execution.status === 'success' ? completedAt : connection.last_synced_at,
    last_successful_sync_at: execution.status === 'success' ? completedAt : connection.last_successful_sync_at,
    session_expires_at: execution.status === 'expired' ? completedAt : connection.session_expires_at,
    last_error: execution.status === 'success' || execution.status === 'noop' ? null : execution.error ?? null,
    sync_error: execution.status === 'success' || execution.status === 'noop' ? null : execution.error ?? null,
    next_sync_at:
      execution.status === 'success' || execution.status === 'noop'
        ? new Date(Date.now() + AUTO_SYNC_INTERVAL_MS).toISOString()
        : connection.last_successful_sync_at ?? null,
    last_reconnect_attempt_at: execution.status === 'expired' ? completedAt : null,
    reconnect_attempts:
      execution.status === 'expired'
        ? ((connection as unknown as { reconnect_attempts?: number }).reconnect_attempts ?? 0) + 1
        : (connection as unknown as { reconnect_attempts?: number }).reconnect_attempts ?? 0,
    metadata: {
      ...(connection.metadata ?? {}),
      provider: PRIMARY_PORTAL_CONNECTOR_KEY,
      auth_mode: 'browser_managed_session',
      sync_stage: execution.status === 'success' ? 'completed' : 'failed_or_pending_reconnect',
      last_sync_trigger_type: args.triggerType,
    },
  });

  return {
    connection: updatedConnection,
    execution,
  };
}

export async function maybeAutoSyncPortalConnection(args: { userId: string; reason?: string; force?: boolean }) {
  const connection = await ensurePortalConnection(args.userId);
  const now = Date.now();
  const session = readPortalSession();

  if (connection.connection_status === 'disconnected' || !connection.sync_enabled) {
    return { skipped: true, reason: 'connection_disabled' as const };
  }

  if (!session) {
    const nowAt = nowIso();
    await upsertConnection(args.userId, {
      connection_status: 'reconnect_required',
      sync_enabled: false,
      session_expires_at: nowAt,
      last_reconnect_attempt_at: nowAt,
      reconnect_attempts: ((connection as unknown as { reconnect_attempts?: number }).reconnect_attempts ?? 0) + 1,
      last_error: 'Sessão expirada. Reconexão necessária.',
      sync_error: 'Sessão expirada. Reconexão necessária.',
      metadata: {
        ...(connection.metadata ?? {}),
        auto_sync_reason: args.reason ?? 'unspecified',
      },
    });
    console.warn('[portal-sync] auto reconnect required: local session missing');
    return { skipped: true, reason: 'reconnect_required' as const };
  }

  const nextSyncAtMs = connection.last_successful_sync_at
    ? new Date(connection.last_successful_sync_at).getTime() + AUTO_SYNC_INTERVAL_MS
    : 0;
  const shouldSync = Boolean(args.force) || !connection.last_successful_sync_at || now >= nextSyncAtMs;

  if (!shouldSync) {
    console.log('[portal-sync] auto sync skipped: interval not reached');
    return { skipped: true, reason: 'interval_not_reached' as const };
  }

  console.log('[portal-sync] auto sync started', { reason: args.reason ?? 'periodic' });
  const result = await syncPortalConnectionInternal({
    userId: args.userId,
    triggerType: 'auto',
  });
  console.log('[portal-sync] auto sync finished', { status: result.execution.status });
  return { skipped: false, result };
}
