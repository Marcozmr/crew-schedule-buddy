/**
 * Regra única: horas de voo (limites RBAC / cartão "30 dias") = trechos em voo operacional real.
 * Conta: entry_type flight + situação OP (tripulando), com exclusões explícitas (PS, reserva, etc.).
 */

import type { ScheduleEntry } from '@/hooks/useScheduleData';

/** Códigos que nunca contam como hora de voo operacional (bloco). */
const EXCLUDED_CREW_STATUS = new Set([
  'PS',
  'PSB',
  'PSI',
  'APR',
  'DO',
  'HSB',
  'ASB',
  'HSBE',
  'SBY',
  'RSV',
  'RES',
  'STB',
  'GND',
  'ADM',
  'TRE',
  'SIM',
]);

function normalizeLabel(label: string | null | undefined): string {
  return (label || '').trim().toLowerCase();
}

/**
 * Indica se o bloco do trecho deve entrar em "Horas de voo" (30d / motor RBAC FH).
 * Manual import: sem crew_status → tratado como OP (ver ManualProvider que grava OP).
 */
export function countsAsOperationalFlightBlockHours(e: Pick<
  ScheduleEntry,
  | 'is_flight'
  | 'entry_type'
  | 'activity_type'
  | 'crew_status_code'
  | 'crew_status_label'
>): boolean {
  if (!e.is_flight) return false;

  const et = (e.entry_type || '').trim().toLowerCase();
  if (et && et !== 'flight') return false;

  const at = (e.activity_type || '').toUpperCase().trim();
  if (at && /STANDBY|RESERVA|FOLGA|APR|HSB|ASB|HSBE|DO|GND|ADM|TRE|SIM/i.test(at)) {
    return false;
  }

  const code = (e.crew_status_code || '').toUpperCase().trim();
  if (code && EXCLUDED_CREW_STATUS.has(code)) return false;

  const lab = normalizeLabel(e.crew_status_label);
  if (
    lab &&
    (lab.includes('extra remunerado') ||
      lab.includes('reposicion') ||
      lab.includes('apresentacao') ||
      lab.includes('reserva') ||
      lab.includes('sobreaviso') ||
      lab.includes('folga') ||
      lab.includes('standby'))
  ) {
    return false;
  }

  if (code === 'OP') return true;
  if (lab.includes('tripulando')) return true;

  // Legacy / manual: sem código nem label → assume voo operacional (entrada manual grava OP no insert atual).
  if (!code && !e.crew_status_label) return true;

  return false;
}

export function logOperationalFlightHoursDev(
  schedule: ScheduleEntry[],
  label = 'metrics',
): void {
  if (!import.meta.env.DEV) return;

  const included: string[] = [];
  const excluded: string[] = [];

  for (const e of schedule) {
    if (!e.is_flight) continue;
    const ok = countsAsOperationalFlightBlockHours(e);
    const line = `${e.date} ${e.flight_number} entry_type=${e.entry_type ?? '∅'} crew=${e.crew_status_code ?? '∅'}`;
    if (ok) included.push(line);
    else excluded.push(line);
  }

  console.log(
    `[operational-flight-hours:${label}] contados OP/tripulando (ou legacy sem status): ${included.length}`,
    included.slice(0, 40),
  );
  if (excluded.length) {
    console.log(
      `[operational-flight-hours:${label}] excluídos do bloco de horas de voo: ${excluded.length}`,
      excluded.slice(0, 40),
    );
  }
}
