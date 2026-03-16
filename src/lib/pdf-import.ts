import { supabase } from '@/integrations/supabase/client';
import { parseMockSchedule, detectAirline } from '@/lib/store';
import type { ScheduleEntry } from '@/lib/types';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export interface PdfImportResult {
  success: boolean;
  parsedCount: number;
  insertedCount: number;
  airline: string;
  fileName: string;
  error: string | null;
}

async function extractTextFromPdf(pdfBytes: ArrayBuffer): Promise<string> {
  const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const textChunks: string[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText) textChunks.push(pageText);
  }

  return textChunks.join('\n');
}

function normalizeDate(rawDate: string): string {
  const parts = rawDate.split(/[\/\-]/).map((p) => p.trim());
  if (parts.length !== 3) return rawDate;
  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  const yr = parts[2];
  const year = yr.length === 4 ? yr : String(Number(yr) >= 70 ? 1900 + Number(yr) : 2000 + Number(yr));
  return `${day}/${month}/${year}`;
}

function parseScheduleFromText(text: string): ScheduleEntry[] {
  // Try default parser first
  const parsed = parseMockSchedule(text);
  if (parsed.length > 0) return parsed;

  // Extended parser
  const sanitized = text.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ');
  const airline = detectAirline(sanitized);
  const uniqueKeys = new Set<string>();
  const entries: ScheduleEntry[] = [];

  const patterns = [
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}).{0,30}?([A-Z]{2}\s?\d{3,4}).{0,24}?([A-Z]{3})\s*(?:[-–>]|\s)\s*([A-Z]{3}).{0,20}?(\d{1,2}:\d{2}).{0,10}?(\d{1,2}:\d{2})/g,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}).{0,30}?([A-Z]{2}\s?\d{3,4}).{0,20}?(\d{1,2}:\d{2}).{0,10}?(\d{1,2}:\d{2})/g,
  ];

  for (const pattern of patterns) {
    for (const match of sanitized.matchAll(pattern)) {
      const date = normalizeDate(match[1]);
      const flightNumber = match[2].replace(/\s/g, '').toUpperCase();
      const departure = match.length >= 6 ? (match[3] ?? 'TBD') : 'TBD';
      const arrival = match.length >= 6 ? (match[4] ?? 'TBD') : 'TBD';
      const departureTime = match.length >= 6 ? (match[5] ?? '00:00') : (match[3] ?? '00:00');
      const arrivalTime = match.length >= 6 ? (match[6] ?? '00:00') : (match[4] ?? '00:00');

      const key = `${date}|${flightNumber}|${departureTime}|${arrivalTime}`;
      if (uniqueKeys.has(key)) continue;
      uniqueKeys.add(key);

      const [dh, dm] = departureTime.split(':').map(Number);
      const [ah, am] = arrivalTime.split(':').map(Number);
      let diff = (ah * 60 + am) - (dh * 60 + dm);
      if (diff < 0) diff += 1440;
      const dutyHours = Math.round((diff / 60) * 10) / 10;

      const reportMinutes = (dh * 60 + dm - 60 + 1440) % 1440;
      const reportTime = `${String(Math.floor(reportMinutes / 60)).padStart(2, '0')}:${String(reportMinutes % 60).padStart(2, '0')}`;

      entries.push({
        id: crypto.randomUUID(),
        date,
        flightNumber,
        departure,
        arrival,
        departureTime,
        arrivalTime,
        status: 'scheduled',
        airline,
        reportTime,
        dutyHours,
      });
    }
  }

  return entries;
}

export async function importPdfFile(file: File, userId: string): Promise<PdfImportResult> {
  const fileName = file.name;

  try {
    // 1. Read file bytes
    const arrayBuffer = await file.arrayBuffer();
    const pdfBytes = new Uint8Array(arrayBuffer);

    // 2. Upload to storage
    const storagePath = `${userId}/${fileName}`;
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });

    await supabase.storage
      .from('crew-rosters')
      .upload(storagePath, blob, { contentType: 'application/pdf', upsert: true });

    // 3. Extract text
    let extractedText: string;
    try {
      extractedText = await extractTextFromPdf(arrayBuffer);
    } catch (err) {
      return { success: false, parsedCount: 0, insertedCount: 0, airline: '', fileName, error: `Falha ao extrair texto do PDF: ${err instanceof Error ? err.message : 'erro desconhecido'}` };
    }

    if (!extractedText.trim()) {
      return { success: false, parsedCount: 0, insertedCount: 0, airline: '', fileName, error: 'O PDF não contém texto extraível. Pode ser um PDF de imagem (escaneado).' };
    }

    // 4. Parse schedule
    const entries = parseScheduleFromText(extractedText);
    const airline = detectAirline(extractedText);

    if (entries.length === 0) {
      return { success: false, parsedCount: 0, insertedCount: 0, airline, fileName, error: 'Nenhum voo identificado no PDF. Verifique se o formato contém datas, números de voo e horários.' };
    }

    // 5. Dedup against existing
    const { data: existingRows } = await supabase
      .from('schedule_entries')
      .select('date, flight_number, departure_time, arrival_time')
      .eq('user_id', userId);

    const existingKeys = new Set(
      (existingRows ?? []).map((r) => `${r.date}|${r.flight_number}|${r.departure_time}|${r.arrival_time}`)
    );

    const rows = entries
      .filter((e) => !existingKeys.has(`${e.date}|${e.flightNumber}|${e.departureTime}|${e.arrivalTime}`))
      .map((e) => ({
        user_id: userId,
        date: e.date,
        flight_number: e.flightNumber,
        departure: e.departure,
        arrival: e.arrival,
        departure_time: e.departureTime,
        arrival_time: e.arrivalTime,
        status: e.status,
        airline: e.airline,
        report_time: e.reportTime || null,
        duty_hours: e.dutyHours || null,
      }));

    let insertedCount = 0;
    if (rows.length > 0) {
      const { error: insertError } = await supabase.from('schedule_entries').insert(rows);
      if (insertError) {
        // Try individual inserts
        for (const row of rows) {
          const { error } = await supabase.from('schedule_entries').insert(row);
          if (!error) insertedCount++;
        }
        if (insertedCount === 0) {
          return { success: false, parsedCount: entries.length, insertedCount: 0, airline, fileName, error: `Erro ao salvar voos: ${insertError.message}` };
        }
      } else {
        insertedCount = rows.length;
      }
    }

    // 6. Save import metadata
    await supabase.from('imported_rosters').insert({
      user_id: userId,
      file_name: fileName,
      source_message_id: `manual-upload-${Date.now()}`,
      storage_path: storagePath,
    });

    // 7. Update airline on profile
    if (airline !== 'Não identificada') {
      await supabase.from('profiles').update({ airline }).eq('user_id', userId);
    }

    return {
      success: true,
      parsedCount: entries.length,
      insertedCount,
      airline,
      fileName,
      error: insertedCount === 0 && rows.length === 0 ? 'Todos os voos já estavam importados (duplicados).' : null,
    };
  } catch (err) {
    return { success: false, parsedCount: 0, insertedCount: 0, airline: '', fileName, error: err instanceof Error ? err.message : 'Erro desconhecido' };
  }
}
