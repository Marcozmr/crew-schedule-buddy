/**
 * ManualProvider — importação manual de escala.
 * Permite criar/ajustar escala sem PDF.
 */

import { RosterProvider } from './RosterProvider';
import { parseMockSchedule, detectAirline } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { emitRosterUpdated } from '@/lib/events/roster-events';
import { UserRosterConnectionService } from '@/modules/roster/services/UserRosterConnectionService';
import { dedupeScheduleEntryRows } from '@/lib/schedule-entry-dedupe';
import type { ConnectionResult, ProviderStatus, RosterSourceInfo, RosterSyncResult } from '../types';

export interface ManualImportInput {
  text: string;
  fileName?: string;
}

export class ManualProvider extends RosterProvider {
  readonly id = 'manual' as const;
  readonly name = 'Importação manual';

  async connect(): Promise<ConnectionResult> {
    return { success: true };
  }

  async disconnect(): Promise<void> {
    // Manual não mantém sessão
  }

  async getStatus(): Promise<ProviderStatus> {
    return { status: 'disconnected', message: 'Importação sob demanda' };
  }

  async syncRoster(): Promise<RosterSyncResult> {
    return { success: false, rosterId: null, parsedCount: 0, insertedCount: 0, error: 'Use importação de texto' };
  }

  async importRoster(input: ManualImportInput): Promise<RosterSyncResult> {
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id;
    if (!userId) {
      return { success: false, rosterId: null, parsedCount: 0, insertedCount: 0, error: 'Usuário não autenticado' };
    }

    const entries = parseMockSchedule(input.text);
    if (entries.length === 0) {
      return {
        success: false,
        rosterId: null,
        parsedCount: 0,
        insertedCount: 0,
        error: 'Nenhum voo identificado no texto. Verifique o formato.',
      };
    }

    const airline = detectAirline(input.text);
    const sourceFilename = input.fileName || 'manual-text-input.txt';
    const sourceMessageId = `manual-text-${Date.now()}`;
    const storagePath = `manual/${userId}/${Date.now()}-${sourceFilename}`;

    const { data: prevActive } = await supabase
      .from('imported_rosters')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true)
      .select('id');

    const deactivatedIds = ((prevActive as { id: string }[] | null) ?? []).map((r) => r.id);

    const { data: rosterRow, error: rosterError } = await supabase
      .from('imported_rosters')
      .insert({
        user_id: userId,
        file_name: sourceFilename,
        source_message_id: sourceMessageId,
        storage_path: storagePath,
        parser_version: 'manual-text-v1',
        import_origin: 'manual',
        roster_provider: 'manual',
        source_type: 'manual',
        import_status: 'processing',
        parsed_count: entries.length,
        is_active: true,
        is_official_crew_roster_pdf: false,
      })
      .select('id')
      .single();

    if (rosterError || !rosterRow?.id) {
      return {
        success: false,
        rosterId: null,
        parsedCount: entries.length,
        insertedCount: 0,
        error: rosterError?.message ?? 'Erro ao criar importação',
      };
    }

    const rows = entries.map((entry) => {
      const parts = entry.date.split('/');
      const isoDate =
        parts.length === 3 ? `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}` : entry.date;
      return {
        user_id: userId,
        roster_id: rosterRow.id,
        date: isoDate,
        flight_number: entry.flightNumber,
        departure: entry.departure,
        arrival: entry.arrival,
        departure_time: entry.departureTime,
        arrival_time: entry.arrivalTime,
        status: entry.status,
        airline: entry.airline,
        report_time: entry.reportTime || null,
        duty_hours: entry.dutyHours || null,
        flight_hours: entry.dutyHours || null,
        is_flight: true,
        entry_type: 'flight',
        crew_status_code: 'OP',
        crew_status_label: 'Tripulando',
        activity_type: 'flight',
        sort_datetime: `${isoDate}T${entry.departureTime || '00:00'}:00`,
      };
    });

    const { rows: insertRows, removed: dedupeRemoved } = dedupeScheduleEntryRows(rows);
    if (import.meta.env.DEV && dedupeRemoved > 0) {
      console.warn(`[ManualProvider] dedupe: ${dedupeRemoved} linha(s) repetida(s) removida(s) antes do insert`);
    }

    const { error } = await supabase.from('schedule_entries').insert(insertRows);
    if (error) {
      await supabase
        .from('imported_rosters')
        .update({ import_status: 'error', import_error: error.message, inserted_count: 0 })
        .eq('id', rosterRow.id);
      return {
        success: false,
        rosterId: rosterRow.id,
        parsedCount: entries.length,
        insertedCount: 0,
        error: error.message,
      };
    }

    const nowIso = new Date().toISOString();
    await supabase
      .from('imported_rosters')
      .update({
        import_status: 'success',
        inserted_count: insertRows.length,
        import_error: null,
        synced_at: nowIso,
        last_sync_at: nowIso,
        sync_status: 'success',
      })
      .eq('id', rosterRow.id);

    if (deactivatedIds.length > 0) {
        await supabase
        .from('imported_rosters')
        .update({ superseded_by_roster_id: rosterRow.id })
        .in('id', deactivatedIds);
    }

    await UserRosterConnectionService.recordSuccessfulImport({
      userId,
      rosterId: rosterRow.id,
      connectionType: 'manual_fallback',
    });

    if (airline !== 'Não identificada') {
      await supabase.from('profiles').update({ airline }).eq('user_id', userId);
    }

    emitRosterUpdated({
      userId,
      reason: deactivatedIds.length > 0 ? 'roster_replaced' : 'manual_import',
      at: nowIso,
    });

    return {
      success: true,
      rosterId: rosterRow.id,
      parsedCount: entries.length,
      insertedCount: insertRows.length,
      error: null,
    };
  }

  supportsAutoSync(): boolean {
    return false;
  }

  supportsManualImport(): boolean {
    return true;
  }

  listAvailableSources(): RosterSourceInfo[] {
    return [
      {
        id: 'manual',
        displayName: 'Importação manual',
        description: 'Cole o texto da escala ou envie arquivo TXT/CSV',
        available: true,
      },
    ];
  }
}
