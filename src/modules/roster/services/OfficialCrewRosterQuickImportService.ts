/**
 * Importação rápida do CrewRosterReport a partir do PDF já guardado no Storage.
 * Sem scraping, sem portal automático — apenas reprocessa bytes já autorizados.
 */

import { supabase } from '@/integrations/supabase/client';
import { importPdfArrayBuffer, type PdfImportResult } from '@/lib/pdf-import';
import { isOfficialCrewRosterFileName } from '@/lib/roster/official-crew-roster';

const BUCKET = 'crew-rosters';

export type RecentOfficialImportRow = {
  id: string;
  file_name: string;
  storage_path: string;
  created_at: string;
  is_active: boolean;
  content_sha256: string | null;
  file_size_bytes: number | null;
};

export async function listRecentOfficialCrewRosterImports(
  userId: string,
  limit = 8
): Promise<RecentOfficialImportRow[]> {
  const { data, error } = await supabase
    .from('imported_rosters')
    .select('id, file_name, storage_path, created_at, is_active, content_sha256, file_size_bytes')
    .eq('user_id', userId)
    .eq('is_official_crew_roster_pdf', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[OfficialCrewRosterQuickImport]', error.message);
    return [];
  }
  return (data ?? []) as RecentOfficialImportRow[];
}

export async function importFromStoredOfficialRow(userId: string, rosterId: string): Promise<PdfImportResult> {
  const { data: row, error } = await supabase
    .from('imported_rosters')
    .select('id, file_name, storage_path, user_id, is_official_crew_roster_pdf')
    .eq('id', rosterId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !row) {
    return {
      success: false,
      header: null,
      parsedCount: 0,
      insertedCount: 0,
      rosterId: null,
      fileName: '',
      extractedTextPreview: '',
      parsedEntriesPreview: [],
      savedRowsPreview: [],
      debug: {
        currentUserId: userId,
        rosterId: null,
        deactivatedRosterIds: [],
        activeRoster: null,
        totalRowsActiveRoster: 0,
        totalRowsOldRosters: 0,
      },
      textByDay: {},
      parseStats: {
        totalRawAnchors: 0,
        totalFlights: 0,
        totalDO: 0,
        totalStandby: 0,
        totalAPR: 0,
        totalAfterDedup: 0,
      },
      error: 'Registro não encontrado.',
    };
  }

  const r = row as {
    file_name: string;
    storage_path: string | null;
    is_official_crew_roster_pdf: boolean | null;
  };

  if (!r.is_official_crew_roster_pdf || !isOfficialCrewRosterFileName(r.file_name)) {
    return {
      success: false,
      header: null,
      parsedCount: 0,
      insertedCount: 0,
      rosterId: null,
      fileName: r.file_name,
      extractedTextPreview: '',
      parsedEntriesPreview: [],
      savedRowsPreview: [],
      debug: {
        currentUserId: userId,
        rosterId: null,
        deactivatedRosterIds: [],
        activeRoster: null,
        totalRowsActiveRoster: 0,
        totalRowsOldRosters: 0,
      },
      textByDay: {},
      parseStats: {
        totalRawAnchors: 0,
        totalFlights: 0,
        totalDO: 0,
        totalStandby: 0,
        totalAPR: 0,
        totalAfterDedup: 0,
      },
      error: 'Apenas PDFs CrewRosterReport são aceitos neste fluxo.',
    };
  }

  const path = r.storage_path?.trim();
  if (!path) {
    return {
      success: false,
      header: null,
      parsedCount: 0,
      insertedCount: 0,
      rosterId: null,
      fileName: r.file_name,
      extractedTextPreview: '',
      parsedEntriesPreview: [],
      savedRowsPreview: [],
      debug: {
        currentUserId: userId,
        rosterId: null,
        deactivatedRosterIds: [],
        activeRoster: null,
        totalRowsActiveRoster: 0,
        totalRowsOldRosters: 0,
      },
      textByDay: {},
      parseStats: {
        totalRawAnchors: 0,
        totalFlights: 0,
        totalDO: 0,
        totalStandby: 0,
        totalAPR: 0,
        totalAfterDedup: 0,
      },
      error: 'PDF não está no armazenamento.',
    };
  }

  const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(path);
  if (dlErr || !blob) {
    return {
      success: false,
      header: null,
      parsedCount: 0,
      insertedCount: 0,
      rosterId: null,
      fileName: r.file_name,
      extractedTextPreview: '',
      parsedEntriesPreview: [],
      savedRowsPreview: [],
      debug: {
        currentUserId: userId,
        rosterId: null,
        deactivatedRosterIds: [],
        activeRoster: null,
        totalRowsActiveRoster: 0,
        totalRowsOldRosters: 0,
      },
      textByDay: {},
      parseStats: {
        totalRawAnchors: 0,
        totalFlights: 0,
        totalDO: 0,
        totalStandby: 0,
        totalAPR: 0,
        totalAfterDedup: 0,
      },
      error: 'Não foi possível baixar o PDF do armazenamento.',
    };
  }

  const buf = await blob.arrayBuffer();
  return importPdfArrayBuffer(r.file_name, buf, userId);
}

export async function importLatestOfficialCrewRosterFromStorage(userId: string): Promise<PdfImportResult> {
  const rows = await listRecentOfficialCrewRosterImports(userId, 1);
  const row = rows[0];
  if (!row?.storage_path?.trim()) {
    return {
      success: false,
      header: null,
      parsedCount: 0,
      insertedCount: 0,
      rosterId: null,
      fileName: '',
      extractedTextPreview: '',
      parsedEntriesPreview: [],
      savedRowsPreview: [],
      debug: {
        currentUserId: userId,
        rosterId: null,
        deactivatedRosterIds: [],
        activeRoster: null,
        totalRowsActiveRoster: 0,
        totalRowsOldRosters: 0,
      },
      textByDay: {},
      parseStats: {
        totalRawAnchors: 0,
        totalFlights: 0,
        totalDO: 0,
        totalStandby: 0,
        totalAPR: 0,
        totalAfterDedup: 0,
      },
      error: 'Nenhum CrewRosterReport anterior encontrado. Importe um PDF oficial primeiro.',
    };
  }
  return importFromStoredOfficialRow(userId, row.id);
}
