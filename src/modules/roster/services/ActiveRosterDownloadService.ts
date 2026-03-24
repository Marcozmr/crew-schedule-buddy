/**
 * Download da escala importada: apenas o PDF oficial armazenado no bucket.
 * Sem PDF persistido, o download não substitui por outro formato (produto honesto).
 */

import { supabase } from '@/integrations/supabase/client';
import { UserRosterConnectionService } from '@/modules/roster/services/UserRosterConnectionService';

const STORAGE_BUCKET = 'crew-rosters';

export type ActiveRosterDownloadResult =
  | { ok: true; kind: 'pdf'; fileName: string }
  | { ok: false; code: 'NO_ACTIVE_ROSTER' | 'NO_PDF_IN_STORAGE' };

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Exporta entradas da escala como CSV (UTF-8 com BOM para Excel). */
export function buildScheduleEntriesCsv(rows: Record<string, unknown>[]): string {
  const headers = [
    'data',
    'atividade',
    'voo',
    'partida',
    'chegada',
    'hora_saida',
    'hora_chegada',
    'tipo',
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        escapeCsvCell(r.date as string),
        escapeCsvCell(r.activity_type as string),
        escapeCsvCell(r.flight_number as string),
        escapeCsvCell((r.departure_airport ?? r.departure) as string),
        escapeCsvCell((r.arrival_airport ?? r.arrival) as string),
        escapeCsvCell(r.departure_time as string),
        escapeCsvCell(r.arrival_time as string),
        escapeCsvCell(r.is_flight ? 'voo' : 'outro'),
      ].join(',')
    );
  }
  return `\uFEFF${lines.join('\n')}`;
}

async function tryDownloadPdfFromStorage(storagePath: string, fileName: string): Promise<boolean> {
  const { data: blob, error } = await supabase.storage.from(STORAGE_BUCKET).download(storagePath);
  if (error || !blob) return false;
  const safeName = fileName?.trim() || 'escala';
  const downloadName = safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`;
  triggerBrowserDownload(blob, downloadName);
  return true;
}

/**
 * Baixa o PDF armazenado para o roster.
 */
export async function downloadImportedRosterById(
  userId: string,
  rosterId: string
): Promise<ActiveRosterDownloadResult> {
  const { data: roster, error } = await supabase
    .from('imported_rosters')
    .select('id, file_name, storage_path, user_id')
    .eq('id', rosterId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !roster) {
    return { ok: false, code: 'NO_ACTIVE_ROSTER' };
  }

  const row = roster as { id: string; file_name: string; storage_path: string | null };
  const path = row.storage_path?.trim();
  const name = row.file_name?.trim() || 'escala';

  if (path) {
    const ok = await tryDownloadPdfFromStorage(path, name);
    if (ok) {
      return { ok: true, kind: 'pdf', fileName: name };
    }
  }

  return { ok: false, code: 'NO_PDF_IN_STORAGE' };
}

/** Escala ativa (conexão + is_active alinhados). */
export async function downloadActiveRoster(userId: string): Promise<ActiveRosterDownloadResult> {
  const id = await UserRosterConnectionService.resolveActiveRosterId(userId);
  if (!id) {
    return { ok: false, code: 'NO_ACTIVE_ROSTER' };
  }

  return downloadImportedRosterById(userId, id);
}
