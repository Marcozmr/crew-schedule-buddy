/**
 * Persiste base detectada em `user_settings`, respeitando lock manual.
 */

import { supabase } from '@/integrations/supabase/client';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import type { DashboardScheduleSourceKind } from '@/lib/roster/dashboard-schedule-consolidation';
import {
  detectUserBaseFromRoster,
  mapDashboardKindToImportSource,
  type HomeBaseImportSource,
} from '@/lib/roster/detect-user-base';
import { dispatchOperationalPreferencesChanged } from '@/lib/events/operational-preferences-events';

export interface ApplyHomeBaseFromRosterArgs {
  userId: string;
  entries: ScheduleEntry[];
  rosterExplicitBase: string | null | undefined;
  dashboardSourceKind: DashboardScheduleSourceKind;
}

/**
 * Chamado após escala válida carregada. Upsert idempotente.
 */
export async function applyHomeBaseFromRoster(args: ApplyHomeBaseFromRosterArgs): Promise<void> {
  const { userId, entries, rosterExplicitBase, dashboardSourceKind } = args;
  if (!entries.length) return;

  const importSource = mapDashboardKindToImportSource(dashboardSourceKind);
  const detection = detectUserBaseFromRoster({
    explicitHeaderBase: rosterExplicitBase,
    entries,
    importSource,
  });

  const { data: row, error: fetchErr } = await supabase
    .from('user_settings')
    .select('base_airport, home_base_user_locked')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr && import.meta.env.DEV) {
    console.warn('[applyHomeBaseFromRoster] leitura user_settings:', fetchErr.message);
  }

  const locked = Boolean((row as { home_base_user_locked?: boolean } | null)?.home_base_user_locked);

  const persistedSource: HomeBaseImportSource =
    detection.source === 'inferred' ? 'inferred' : importSource;

  if (!detection.base) {
    if (import.meta.env.DEV) {
      console.info('[applyHomeBaseFromRoster] nenhuma base segura — nada alterado em base_airport');
    }
    dispatchOperationalPreferencesChanged();
    return;
  }

  if (locked) {
    await supabase.from('user_settings').upsert(
      {
        user_id: userId,
        detected_base_airport: detection.base,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (import.meta.env.DEV) {
      console.info('[applyHomeBaseFromRoster] lock manual — só detected_base_airport', detection.base);
    }
    dispatchOperationalPreferencesChanged();
    return;
  }

  if (detection.confidence === 'low') {
    await supabase.from('user_settings').upsert(
      {
        user_id: userId,
        detected_base_airport: detection.base,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (import.meta.env.DEV) {
      console.info('[applyHomeBaseFromRoster] confiança baixa — auditoria apenas', detection.base);
    }
    dispatchOperationalPreferencesChanged();
    return;
  }

  await supabase.from('user_settings').upsert(
    {
      user_id: userId,
      base_airport: detection.base,
      detected_base_airport: detection.base,
      home_base_source: persistedSource,
      home_base_user_locked: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (import.meta.env.DEV) {
    console.info('[applyHomeBaseFromRoster] base aplicada', {
      base: detection.base,
      source: persistedSource,
      confidence: detection.confidence,
    });
  }

  dispatchOperationalPreferencesChanged();
}
