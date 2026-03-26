/**
 * Persistência da conexão de escala (Supabase) — backend como fonte da escala ativa.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  classifyDashboardRosterSource,
  dashboardSourceLabel,
  pickDashboardRosterId,
  type DashboardScheduleSourceKind,
  type ImportedRosterForDashboardPick,
} from '@/lib/roster/dashboard-schedule-consolidation';

export type UserRosterConnectionType =
  | 'corporate_pdf'
  | 'official_pdf'
  | 'manual_fallback'
  | 'future_enterprise_sync';

/** Fluxo produto: portal → SAB/iFlight (manual) → PDF CrewRosterReport importado. */
export type RosterConnectionState =
  | 'idle'
  | 'portal_connected'
  | 'awaiting_iflight_roster'
  | 'iflight_accessed'
  | 'roster_connected';

export interface UserRosterConnectionRow {
  id: string;
  user_id: string;
  connection_type: UserRosterConnectionType;
  connection_status: 'disconnected' | 'connecting' | 'connected' | 'error';
  roster_connection_state: RosterConnectionState;
  connected_at: string | null;
  last_checked_at: string | null;
  last_successful_import_at: string | null;
  current_active_roster_id: string | null;
  last_error: string | null;
  is_auto_update_enabled: boolean;
  created_at: string;
  updated_at: string;
}

function normalizeUserRosterRow(
  data: unknown,
): UserRosterConnectionRow {
  const row = data as UserRosterConnectionRow & { roster_connection_state?: RosterConnectionState };
  return {
    ...row,
    roster_connection_state: row.roster_connection_state ?? 'idle',
  };
}

export const UserRosterConnectionService = {
  /**
   * Garante uma linha em `user_roster_connection` para o usuário (novo usuário / migração).
   * Idempotente: se já existir, devolve a linha atual.
   */
  async ensureDefaultUserRosterConnection(userId: string): Promise<UserRosterConnectionRow | null> {
    if (import.meta.env.DEV) {
      console.info(
        '[UserRosterConnectionService] user_roster_connection ausente — criando registro padrão (manual_fallback / idle)',
        userId,
      );
    }

    const { data: inserted, error } = await supabase
      .from('user_roster_connection')
      .insert({
        user_id: userId,
        connection_type: 'manual_fallback',
        connection_status: 'disconnected',
        roster_connection_state: 'idle',
        is_auto_update_enabled: true,
      })
      .select('*')
      .single();

    if (!error && inserted) {
      if (import.meta.env.DEV) {
        console.info('[UserRosterConnectionService] registro padrão criado', (inserted as { id?: string }).id);
      }
      return normalizeUserRosterRow(inserted);
    }

    const code = (error as { code?: string } | null)?.code;
    const msg = error?.message ?? '';
    const isDuplicate =
      code === '23505' || /duplicate key|unique constraint/i.test(msg);
    if (isDuplicate) {
      const { data: again, error: fetchErr } = await supabase
        .from('user_roster_connection')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (fetchErr) {
        console.warn('[UserRosterConnectionService] ensureDefault fetch after race', fetchErr.message);
        return null;
      }
      if (again) {
        if (import.meta.env.DEV) {
          console.info('[UserRosterConnectionService] registro já existia (corrida) — usando linha existente');
        }
        return normalizeUserRosterRow(again);
      }
    }

    console.warn('[UserRosterConnectionService] ensureDefault insert failed', msg);
    return null;
  },

  /**
   * Roster ativo: alinha `user_roster_connection.current_active_roster_id` com `imported_rosters.is_active`.
   */
  async resolveActiveRosterId(userId: string): Promise<string | null> {
    const row = await UserRosterConnectionService.fetchByUserId(userId);
    if (row?.current_active_roster_id) {
      const { data } = await supabase
        .from('imported_rosters')
        .select('id')
        .eq('id', row.current_active_roster_id)
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();
      const id = (data as { id: string } | null)?.id;
      if (id) return id;
    }
    const { data: active } = await supabase
      .from('imported_rosters')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return (active as { id: string } | null)?.id ?? null;
  },

  /**
   * Roster que alimenta dashboard / Flight Board Pro / cartões operacionais.
   * Prioriza portal/sincronizado sobre PDF e manual quando há dados utilizáveis.
   * Não substitui `resolveActiveRosterId` (automação e downloads podem continuar usando aquela).
   */
  async resolveDashboardRosterId(userId: string): Promise<string | null> {
    const ctx = await UserRosterConnectionService.resolveDashboardRosterContext(userId);
    return ctx.rosterId;
  },

  /** Contexto da fonte vencedora (cartões / Flight Board / rastreabilidade na UI). */
  async resolveDashboardRosterContext(userId: string): Promise<{
    rosterId: string | null;
    sourceKind: DashboardScheduleSourceKind;
    sourceLabel: string;
  }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('imported_rosters') as any)
      .select(
        'id, is_active, inserted_count, parsed_count, import_status, roster_provider, source_type, roster_source, import_origin, portal_connection_id, connector_key, synced_at, last_sync_at, is_official_crew_roster_pdf, superseded_by_roster_id, created_at',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(48);

    if (error) {
      console.warn('[UserRosterConnectionService] resolveDashboardRosterContext', error.message);
      const fallback = await UserRosterConnectionService.resolveActiveRosterId(userId);
      return {
        rosterId: fallback,
        sourceKind: 'unknown',
        sourceLabel: dashboardSourceLabel('unknown'),
      };
    }

    const rows = (data ?? []) as ImportedRosterForDashboardPick[];
    const picked = pickDashboardRosterId(rows);
    if (!picked) {
      const fallback = await UserRosterConnectionService.resolveActiveRosterId(userId);
      return {
        rosterId: fallback,
        sourceKind: 'unknown',
        sourceLabel: dashboardSourceLabel('unknown'),
      };
    }

    const row = rows.find((r) => r.id === picked);
    const sourceKind = row ? classifyDashboardRosterSource(row) : 'unknown';
    return {
      rosterId: picked,
      sourceKind,
      sourceLabel: dashboardSourceLabel(sourceKind),
    };
  },

  async fetchByUserId(userId: string): Promise<UserRosterConnectionRow | null> {
    const { data, error } = await supabase
      .from('user_roster_connection')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.warn('[UserRosterConnectionService] fetch', error.message);
      return null;
    }
    if (data) {
      return normalizeUserRosterRow(data);
    }
    if (import.meta.env.DEV) {
      console.info('[UserRosterConnectionService] fetchByUserId: sem linha — usando ensureDefaultUserRosterConnection');
    }
    return UserRosterConnectionService.ensureDefaultUserRosterConnection(userId);
  },

  /**
   * Persiste etapa do fluxo (Supabase). `connection_status` = connected somente em roster_connected.
   */
  async setRosterConnectionState(userId: string, state: RosterConnectionState): Promise<void> {
    const existing = await UserRosterConnectionService.fetchByUserId(userId);
    const now = new Date().toISOString();

    let connection_status: 'disconnected' | 'connecting' | 'connected' | 'error' =
      existing?.connection_status ?? 'disconnected';
    if (state === 'roster_connected') connection_status = 'connected';
    else if (
      state === 'portal_connected' ||
      state === 'awaiting_iflight_roster' ||
      state === 'iflight_accessed'
    )
      connection_status = 'connecting';
    else if (state === 'idle') connection_status = 'disconnected';

    const { error } = await supabase.from('user_roster_connection').upsert(
      {
        user_id: userId,
        connection_type: existing?.connection_type ?? 'official_pdf',
        connection_status,
        roster_connection_state: state,
        last_checked_at: now,
        connected_at: existing?.connected_at ?? null,
        last_successful_import_at: existing?.last_successful_import_at ?? null,
        current_active_roster_id: existing?.current_active_roster_id ?? null,
        last_error: null,
        is_auto_update_enabled: existing?.is_auto_update_enabled ?? true,
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      console.warn('[UserRosterConnectionService] setRosterConnectionState', error.message);
    }
  },

  /**
   * Após autenticação no portal reconhecida: próximo passo manual é SAB → iFlight → voltar ao app.
   * (Fluxo lógico: portal_connected → awaiting_iflight_roster — aqui persistimos awaiting_iflight_roster.)
   */
  async advancePortalToAwaitingIFlight(userId: string): Promise<void> {
    await UserRosterConnectionService.setRosterConnectionState(userId, 'awaiting_iflight_roster');
  },

  /** Após desconectar o portal na UI: volta ao idle se ainda não havia escala importada no fluxo. */
  async clearPortalSessionFlags(userId: string): Promise<void> {
    const existing = await UserRosterConnectionService.fetchByUserId(userId);
    if (!existing || existing.roster_connection_state === 'roster_connected') return;
    const { error } = await supabase
      .from('user_roster_connection')
      .update({
        roster_connection_state: 'idle',
        connection_status: 'disconnected',
      })
      .eq('user_id', userId);
    if (error) {
      console.warn('[UserRosterConnectionService] clearPortalSessionFlags', error.message);
    }
  },

  /**
   * Após importação bem-sucedida: marca escala conectada e roster ativo atual.
   */
  async recordSuccessfulImport(params: {
    userId: string;
    rosterId: string;
    connectionType: UserRosterConnectionType;
  }): Promise<void> {
    const now = new Date().toISOString();
    const existing = await UserRosterConnectionService.fetchByUserId(params.userId);
    const connectedAt = existing?.connected_at ?? now;

    const { error } = await supabase.from('user_roster_connection').upsert(
      {
        user_id: params.userId,
        connection_type: params.connectionType,
        connection_status: 'connected',
        roster_connection_state: 'roster_connected',
        connected_at: connectedAt,
        last_checked_at: now,
        last_successful_import_at: now,
        current_active_roster_id: params.rosterId,
        last_error: null,
        is_auto_update_enabled: existing?.is_auto_update_enabled ?? true,
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      console.warn('[UserRosterConnectionService] upsert', error.message);
    }
  },

  async touchLastChecked(userId: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('user_roster_connection')
      .update({ last_checked_at: now })
      .eq('user_id', userId);
    if (error) {
      console.warn('[UserRosterConnectionService] touchLastChecked', error.message);
    }
  },
};
