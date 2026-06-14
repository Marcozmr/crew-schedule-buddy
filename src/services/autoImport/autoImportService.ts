import { supabase } from '@/integrations/supabase/client';
import { importPdfArrayBufferWithClient, type RosterEntry } from '@/lib/pdf-import';
import type { AirlineId, AutoImportResult, NormalizedRoster, RosterChange } from './autoImportTypes';
import { getConnector } from './connectors';

// ── Compare ────────────────────────────────────────────

type DbEntryRow = {
  date: string;
  flight_number: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  departure_airport: string | null;
  arrival_airport: string | null;
  is_flight: boolean;
  activity_type: string | null;
  overnight: boolean | null;
  crew_status_code: string | null;
};

function dbRowToRosterEntry(r: DbEntryRow): Partial<RosterEntry> {
  return {
    date: r.date,
    flightNumber: r.flight_number ?? '',
    departureTime: r.departure_time ?? '',
    arrivalTime: r.arrival_time ?? '',
    departureAirport: r.departure_airport ?? '',
    arrivalAirport: r.arrival_airport ?? '',
    isFlight: r.is_flight,
    activityType: r.activity_type ?? '',
    overnight: r.overnight ?? false,
    crewStatusCode: r.crew_status_code ?? '',
  };
}

async function fetchCurrentEntries(userId: string): Promise<Partial<RosterEntry>[]> {
  const { data: roster } = await (supabase.from('imported_rosters') as any)
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!roster?.id) return [];

  const { data: rows } = await (supabase.from('schedule_entries') as any)
    .select('date,flight_number,departure_time,arrival_time,departure_airport,arrival_airport,is_flight,activity_type,overnight,crew_status_code')
    .eq('user_id', userId)
    .eq('roster_id', roster.id);

  return ((rows ?? []) as DbEntryRow[]).map(dbRowToRosterEntry);
}

export function compareRosters(previous: Partial<RosterEntry>[], next: Partial<RosterEntry>[]): RosterChange[] {
  const changes: RosterChange[] = [];

  const toKey = (e: Partial<RosterEntry>) =>
    `${e.date ?? ''}|${e.flightNumber ?? ''}|${e.departureAirport ?? ''}|${e.arrivalAirport ?? ''}`;

  const prevMap = new Map(previous.map((e) => [toKey(e), e]));
  const nextMap = new Map(next.map((e) => [toKey(e), e]));

  for (const [key, entry] of nextMap) {
    if (!prevMap.has(key)) {
      changes.push({
        type: entry.isFlight ? 'flight_added' : 'day_off_changed',
        date: entry.date ?? '',
        description: entry.isFlight
          ? `Voo ${entry.flightNumber ?? ''} adicionado (${entry.departureAirport ?? ''}→${entry.arrivalAirport ?? ''})`
          : `Atividade adicionada: ${entry.activityType ?? entry.crewStatusCode ?? ''} em ${entry.date ?? ''}`,
      });
      continue;
    }

    const prev = prevMap.get(key)!;

    if (entry.isFlight && prev.isFlight) {
      if (entry.departureTime?.slice(0, 5) !== prev.departureTime?.slice(0, 5) ||
          entry.arrivalTime?.slice(0, 5) !== prev.arrivalTime?.slice(0, 5)) {
        changes.push({
          type: 'time_changed',
          date: entry.date ?? '',
          description: `Voo ${entry.flightNumber ?? ''}: horário alterado (${prev.departureTime?.slice(0, 5)}→${entry.departureTime?.slice(0, 5)})`,
        });
      }
      if (entry.reportTime?.slice(0, 5) !== prev.reportTime?.slice(0, 5)) {
        changes.push({
          type: 'report_time_changed',
          date: entry.date ?? '',
          description: `Voo ${entry.flightNumber ?? ''}: apresentação alterada (${prev.reportTime?.slice(0, 5)}→${entry.reportTime?.slice(0, 5)})`,
        });
      }
      if (Boolean(entry.overnight) !== Boolean(prev.overnight)) {
        changes.push({
          type: 'overnight_changed',
          date: entry.date ?? '',
          description: `Voo ${entry.flightNumber ?? ''}: pernoite ${entry.overnight ? 'adicionado' : 'removido'}`,
        });
      }
    }
  }

  for (const [key, entry] of prevMap) {
    if (!nextMap.has(key)) {
      changes.push({
        type: entry.isFlight ? 'flight_removed' : 'day_off_changed',
        date: entry.date ?? '',
        description: entry.isFlight
          ? `Voo ${entry.flightNumber ?? ''} removido (${entry.departureAirport ?? ''}→${entry.arrivalAirport ?? ''})`
          : `Atividade removida: ${entry.activityType ?? entry.crewStatusCode ?? ''} em ${entry.date ?? ''}`,
      });
    }
  }

  return changes.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Save ───────────────────────────────────────────────

async function saveImportedRoster(
  roster: NormalizedRoster,
  userId: string,
  airline: AirlineId,
): Promise<{ rosterId: string | null; insertedCount: number; parsedCount: number; error: string | null }> {
  const originMap: Record<AirlineId, 'latam_automation' | 'gol_automation' | 'azul_automation' | 'manual'> = {
    LATAM: 'latam_automation',
    GOL: 'gol_automation',
    AZUL: 'azul_automation',
    GENERIC: 'manual',
  };

  const encoder = new TextEncoder();
  const textBytes = encoder.encode(roster.rawText).buffer as ArrayBuffer;
  const fileName = `auto-import-${airline.toLowerCase()}-${Date.now()}.txt`;

  // Usa extractedTextOverride para ignorar pdf.js e reutilizar o texto já extraído.
  // Sem isso, importPdfArrayBufferCore tentaria parsear bytes UTF-8 como PDF e falharia.
  const result = await importPdfArrayBufferWithClient({
    supabaseClient: supabase,
    fileName,
    arrayBuffer: textBytes,
    extractedTextOverride: roster.rawText,
    userId,
    useSessionUser: true,
    emitRosterEvent: true,
    importOrigin: originMap[airline],
    automationRunId: null,
  });

  if (!result.success && !result.duplicate) {
    return { rosterId: null, insertedCount: 0, parsedCount: 0, error: result.error ?? 'Falha ao salvar escala' };
  }

  return {
    rosterId: result.rosterId,
    insertedCount: result.insertedCount,
    parsedCount: result.parsedCount,
    error: null,
  };
}

// ── Public API ─────────────────────────────────────────

/**
 * Abre o portal da companhia numa janela popup.
 * Retorna a janela aberta ou null se bloqueada.
 */
export function startAutoImport(airline: AirlineId): Window | null {
  const connector = getConnector(airline);
  if (!connector.loginUrl) return null;

  const width = 520;
  const height = 680;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  return window.open(
    connector.loginUrl,
    `auto-import-${airline}`,
    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`,
  );
}

export function detectLoginSuccess(airline: AirlineId, url: string, html?: string): boolean {
  return getConnector(airline).detectLoginSuccess(url, html);
}

export function detectRosterPage(airline: AirlineId, url: string, html?: string): boolean {
  return getConnector(airline).detectRosterPage(url, html);
}

export async function extractRosterFromPage(
  airline: AirlineId,
  input: { html?: string; text?: string; currentUrl?: string },
): Promise<NormalizedRoster> {
  return getConnector(airline).extractRoster(input);
}

export async function extractRosterFromPdf(airline: AirlineId, file: File): Promise<NormalizedRoster> {
  const arrayBuffer = await file.arrayBuffer();
  return getConnector(airline).extractRoster({ pdfFile: file, pdfArrayBuffer: arrayBuffer });
}

export async function normalizeRosterData(roster: NormalizedRoster): Promise<NormalizedRoster> {
  return roster;
}

export async function runFullAutoImport(
  airline: AirlineId,
  input: { html?: string; text?: string; pdfFile?: File; pdfArrayBuffer?: ArrayBuffer; currentUrl?: string },
  userId: string,
  onStatusChange?: (status: string) => void,
): Promise<AutoImportResult> {
  try {
    onStatusChange?.('searching_roster');
    const roster = await getConnector(airline).extractRoster(input);

    if (!roster.rawText.trim() && !roster.entries.length) {
      return {
        success: false,
        rosterId: null,
        insertedCount: 0,
        parsedCount: 0,
        changes: [],
        error: 'Não foi possível extrair a escala da página.',
        status: 'error',
      };
    }

    onStatusChange?.('comparing');
    const previous = await fetchCurrentEntries(userId);

    onStatusChange?.('importing');
    const saveResult = await saveImportedRoster(roster, userId, airline);

    if (saveResult.error) {
      return {
        success: false,
        rosterId: null,
        insertedCount: 0,
        parsedCount: 0,
        changes: [],
        error: saveResult.error,
        status: 'error',
      };
    }

    const changes = compareRosters(previous, roster.entries);

    return {
      success: true,
      rosterId: saveResult.rosterId,
      insertedCount: saveResult.insertedCount,
      parsedCount: saveResult.parsedCount,
      changes,
      error: null,
      status: 'completed',
    };
  } catch (err) {
    return {
      success: false,
      rosterId: null,
      insertedCount: 0,
      parsedCount: 0,
      changes: [],
      error: err instanceof Error ? err.message : 'Erro desconhecido ao importar',
      status: 'error',
    };
  }
}
