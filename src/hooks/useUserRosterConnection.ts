import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { subscribeRosterUpdated } from '@/lib/events/roster-events';
import {
  UserRosterConnectionService,
  type UserRosterConnectionRow,
} from '@/modules/roster/services/UserRosterConnectionService';

export interface ActiveRosterMeta {
  id: string;
  file_name: string;
  storage_path: string | null;
  synced_at: string | null;
  updated_at: string | null;
  is_official_crew_roster_pdf: boolean | null;
  /** Fim do período da escala (YYYY-MM-DD quando o parser reconhece a data) — usado pro lembrete de sincronização. */
  roster_end_date: string | null;
}

export function useUserRosterConnection() {
  const { user } = useAuth();
  const [connection, setConnection] = useState<UserRosterConnectionRow | null>(null);
  const [activeRosterMeta, setActiveRosterMeta] = useState<ActiveRosterMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setConnection(null);
      setActiveRosterMeta(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const row = await UserRosterConnectionService.fetchByUserId(user.id);
    setConnection(row);

    if (row?.current_active_roster_id) {
      const { data } = await supabase
        .from('imported_rosters')
        .select('id, file_name, storage_path, synced_at, updated_at, is_official_crew_roster_pdf, roster_end_date')
        .eq('id', row.current_active_roster_id)
        .maybeSingle();
      setActiveRosterMeta((data as ActiveRosterMeta | null) ?? null);
    } else {
      const { data: active } = await supabase
        .from('imported_rosters')
        .select('id, file_name, storage_path, synced_at, updated_at, is_official_crew_roster_pdf, roster_end_date')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setActiveRosterMeta((active as ActiveRosterMeta | null) ?? null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    return subscribeRosterUpdated((d) => {
      if (d.userId !== user.id) return;
      void refresh();
    });
  }, [user, refresh]);

  return { connection, activeRosterMeta, loading, refresh };
}
