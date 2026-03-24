/**
 * Verificação leve de atualização e projeção da escala conectada.
 * Não há polling de portal privado nem APIs não autorizadas — apenas reconciliação com o backend
 * (última escala ativa já persistida) e hooks para futuras fontes enterprise.
 */

import { emitRosterUpdated } from '@/lib/events/roster-events';
import { supabase } from '@/integrations/supabase/client';
import { UserRosterConnectionService } from './UserRosterConnectionService';

const debounceMs = 45_000;
const lastRunByUser = new Map<string, number>();

export type AutoUpdateResult =
  | { status: 'skipped' }
  | { status: 'checked'; activeRosterId: string | null; hadActive: boolean };

export const ConnectedRosterAutoUpdateService = {
  /**
   * Chamado no login, ao focar o app e ao voltar do background.
   * Atualiza last_checked_at e confirma projeção ativa no Supabase (fonte da verdade).
   */
  async runLightUpdateCheck(
    userId: string,
    options?: { force?: boolean; silent?: boolean }
  ): Promise<AutoUpdateResult> {
    const now = Date.now();
    if (!options?.force) {
      const prev = lastRunByUser.get(userId) ?? 0;
      if (now - prev < debounceMs) {
        return { status: 'skipped' };
      }
    }
    lastRunByUser.set(userId, now);

    await UserRosterConnectionService.touchLastChecked(userId);

    const activeRosterId = await UserRosterConnectionService.resolveActiveRosterId(userId);

    let activeRow: { id: string; file_name: string; updated_at?: string; synced_at?: string | null } | null = null;
    if (activeRosterId) {
      const { data } = await supabase
        .from('imported_rosters')
        .select('id, file_name, updated_at, synced_at')
        .eq('id', activeRosterId)
        .maybeSingle();
      activeRow = data as typeof activeRow;
    }

    emitRosterUpdated({
      userId,
      reason: 'auto_update_check',
      at: new Date().toISOString(),
    });

    return {
      status: 'checked',
      activeRosterId: activeRow?.id ?? null,
      hadActive: Boolean(activeRow),
    };
  },

  clearDebounce(userId: string) {
    lastRunByUser.delete(userId);
  },
};
