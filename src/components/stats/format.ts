/** Formatação das estatísticas (pt-BR). */

/** 4924 → "82:04". */
export function hhmm(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

/** 355 → "5h55". */
export function hShort(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
}

export function int(n: number): string {
  return Math.round(n).toLocaleString('pt-BR');
}

export function decimal1(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** "2026-11-14" → "14/nov". */
export function dayMonth(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const month = d.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '');
  return `${d.getUTCDate()}/${month}`;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
