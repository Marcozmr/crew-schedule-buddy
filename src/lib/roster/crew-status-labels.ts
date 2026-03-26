/**
 * Situação do tripulante (CrewRoster LATAM) → rótulos em português popular para a UI.
 * Códigos brutos permanecem em crew_status_code; exibição usa crew_status_label.
 */

import { cn } from '@/lib/utils';

export type NormalizedEntryType =
  | 'flight'
  | 'day_off'
  | 'reserve'
  | 'standby'
  | 'on_call'
  | 'duty_start'
  | 'other_activity';

/** Situação em voo (OP/PS) ou código de atividade. */
export function resolveCrewStatusFromFlightOperation(operationType: string): { code: string; label: string } {
  const o = operationType.toUpperCase();
  if (o === 'OP') return { code: 'OP', label: 'Em operação' };
  if (o === 'PS') return { code: 'PS', label: 'Reposicionamento' };
  return { code: o, label: o };
}

export function resolveCrewStatusFromActivityCode(code: string): { code: string; label: string; entryType: NormalizedEntryType } {
  const c = code.toUpperCase();
  if (c === 'DO' || c === 'OFF' || c === 'X' || c === 'FOLGA') {
    return { code: c === 'DO' ? 'DO' : c, label: 'Folga', entryType: 'day_off' };
  }
  if (c === 'HSB') return { code: 'HSB', label: 'Reserva', entryType: 'reserve' };
  if (c === 'HSBE') return { code: 'HSBE', label: 'Reserva estendida', entryType: 'reserve' };
  if (c === 'ASB') return { code: 'ASB', label: 'Sobreaviso', entryType: 'on_call' };
  if (c === 'APR') return { code: 'APR', label: 'Apresentação', entryType: 'duty_start' };
  if (c === 'STANDBY' || c === 'STBY' || c === 'SBY') {
    return { code: 'STANDBY', label: 'Standby', entryType: 'standby' };
  }
  return { code: c, label: c, entryType: 'other_activity' };
}

/** Função de cabine / cockpit → texto amigável */
export function formatCrewRoleLabel(role: string | null | undefined): string {
  if (!role?.trim()) return '—';
  const r = role.toUpperCase();
  const map: Record<string, string> = {
    CC: 'Comissário',
    CA: 'Comandante',
    FO: 'Copiloto',
    SO: 'Segundo oficial',
    CM: 'Comissário',
    FA: 'Comissário',
    PUR: 'Chefe de cabine',
    CCM: 'Chefe de cabine',
  };
  return map[r] || role;
}

const BADGE_BASE = 'text-[10px] font-medium px-2 py-0.5 rounded-md border whitespace-nowrap';

export function crewStatusBadgeClassName(label: string): string {
  const L = label.toLowerCase();
  if (L === 'em operação') return cn(BADGE_BASE, 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25');
  if (L === 'reposicionamento') return cn(BADGE_BASE, 'bg-amber-500/12 text-amber-800 dark:text-amber-200 border-amber-500/25');
  if (L === 'folga') return cn(BADGE_BASE, 'bg-muted text-muted-foreground border-border');
  if (L === 'reserva') return cn(BADGE_BASE, 'bg-blue-500/12 text-blue-800 dark:text-blue-200 border-blue-500/25');
  if (L === 'reserva estendida') return cn(BADGE_BASE, 'bg-blue-600/15 text-blue-900 dark:text-blue-100 border-blue-600/30');
  if (L === 'sobreaviso') return cn(BADGE_BASE, 'bg-violet-500/12 text-violet-800 dark:text-violet-200 border-violet-500/25');
  if (L === 'apresentação') return cn(BADGE_BASE, 'bg-cyan-500/12 text-cyan-900 dark:text-cyan-100 border-cyan-500/25');
  if (L === 'standby') return cn(BADGE_BASE, 'bg-secondary text-foreground border-border');
  return cn(BADGE_BASE, 'bg-primary/8 text-primary border-primary/20');
}
