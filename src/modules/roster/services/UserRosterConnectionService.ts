/**
 * Persistência da conexão de escala (Supabase) — backend como fonte da escala ativa.
 */

import { supabase } from '@/integrations/supabase/client';

export type UserRosterConnectionType =
  | 'corporate_pdf'
  | 'official_pdf'
  | 'manual_fallback'
  | 'future_enterprise_sync';

export interface UserRosterConnectionRow {
  id: string;
  user_id: string;
  connection_type: UserRosterConnectionType;
  connection_status: 'disconnected' | 'connecting' | 'connected' | 'error';
  connected_at: string | null;
  last_checked_at: string | null;
  last_successful_import_at: string | null;
  current_active_roster_id: string | null;
  last_error: string | null;
  is_auto_update_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export const UserRosterConnectionService = {
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
    return data as UserRosterConnectionRow | null;
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
