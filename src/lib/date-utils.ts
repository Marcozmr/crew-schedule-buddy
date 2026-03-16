// Central date/time formatting utilities for EscalaX
// All display uses America/Sao_Paulo timezone, pt-BR locale

import { TZDate } from '@date-fns/tz';

const BRAZIL_TZ = 'America/Sao_Paulo';

/** Parse a date string (YYYY-MM-DD or DD/MM/YYYY) into a TZDate in BRT */
export function parseDateBRT(dateStr: string): TZDate {
  if (!dateStr) return new TZDate(new Date(), BRAZIL_TZ);
  let year: number, month: number, day: number;
  if (dateStr.includes('-') && dateStr.indexOf('-') === 4) {
    [year, month, day] = dateStr.split('-').map(Number);
  } else {
    const parts = dateStr.split(/[\/\-]/);
    day = parseInt(parts[0]); month = parseInt(parts[1]); year = parseInt(parts[2]);
  }
  return new TZDate(year, month - 1, day, 0, 0, 0, BRAZIL_TZ);
}

/** Convert any date string to a JS Date in local BRT context */
export function toBrazilTZ(dateStr: string): Date {
  return new Date(parseDateBRT(dateStr).getTime());
}

/** Format date as dd/MM/yyyy */
export function formatDateBR(dateStr: string): string {
  if (!dateStr) return '—';
  const d = parseDateBRT(dateStr);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Format time string HH:mm (pass-through, already local) */
export function formatTimeBR(time: string | null | undefined): string {
  if (!time || time === '00:00') return '—';
  return time;
}

/** Format a full ISO datetime or timestamp to dd/MM/yyyy HH:mm BRT */
export function formatDateTimeBR(isoOrTimestamp: string | number | Date | null | undefined): string {
  if (!isoOrTimestamp) return '—';
  const raw = typeof isoOrTimestamp === 'string' ? new Date(isoOrTimestamp).getTime() : typeof isoOrTimestamp === 'number' ? isoOrTimestamp : isoOrTimestamp.getTime();
  const d = new TZDate(raw, BRAZIL_TZ);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${h}:${m}`;
}

/** Format a timestamp to just HH:mm in BRT */
export function formatTimeFromTimestamp(ms: number): string {
  const d = new TZDate(ms, BRAZIL_TZ);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}
