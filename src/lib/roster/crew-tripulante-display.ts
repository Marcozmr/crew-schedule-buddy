/**
 * Camada de apresentação para o tripulante — sem siglas cruas (OP/PS/CC) na UI final.
 * Códigos técnicos permanecem em `operation_type` / `crew_role` no banco.
 */

import type { ScheduleEntry } from '@/hooks/useScheduleData';
import type { CrewSituationDisplay } from '@/services/flightBoard/types';
import { cn } from '@/lib/utils';

const BADGE_BASE = 'text-[10px] font-medium px-2 py-0.5 rounded-md border whitespace-nowrap';

/** Situação no trecho: OP → tripulando, PS → extra remunerado */
export function getTripStatusUserFriendly(operationType: string | null | undefined): {
  label: string;
  variant: 'tripulando' | 'extra_remunerado';
} {
  const o = (operationType || '').trim().toUpperCase();
  if (o === 'PS') return { label: 'Extra remunerado', variant: 'extra_remunerado' };
  return { label: 'Tripulando', variant: 'tripulando' };
}

/**
 * Função em linguagem simples: Chefe / Auxiliar / Comissário (fallback) / cockpit.
 */
export function getCrewRoleUserFriendly(crewRole: string | null | undefined): string {
  if (!crewRole?.trim()) return 'Comissário';
  const r = crewRole.trim().toUpperCase();
  if (/^(PUR|CCM|CCP|TCA)$/.test(r)) return 'Chefe';
  if (/^(CC|CM|FA|TCP)$/.test(r)) return 'Auxiliar';
  if (r === 'CA') return 'Comandante';
  if (r === 'FO' || r === 'SO') return 'Copiloto';
  return 'Comissário';
}

/** Em PS, a função de cabine é secundária — pode ocultar na UI compacta */
export function shouldMinimizeRoleForExtraRemunerado(operationType: string | null | undefined): boolean {
  return (operationType || '').trim().toUpperCase() === 'PS';
}

export function tripStatusBadgeClass(variant: 'tripulando' | 'extra_remunerado'): string {
  if (variant === 'extra_remunerado') {
    return cn(
      BADGE_BASE,
      'bg-amber-500/12 text-amber-900 dark:text-amber-100 border-amber-500/35',
    );
  }
  return cn(
    BADGE_BASE,
    'bg-emerald-500/12 text-emerald-800 dark:text-emerald-200 border-emerald-500/30',
  );
}

export function crewRoleBadgeClass(): string {
  return cn(BADGE_BASE, 'bg-muted/80 text-muted-foreground border-border font-normal');
}

/** Monta o bloco exibido no Flight Board / dashboard a partir da linha da escala. */
export function buildCrewSituationDisplayFromEntry(entry: ScheduleEntry): CrewSituationDisplay | null {
  if (!entry.is_flight) return null;
  const trip = getTripStatusUserFriendly(entry.operation_type);
  return {
    tripStatusLabel: trip.label,
    tripStatusVariant: trip.variant,
    roleLabel: getCrewRoleUserFriendly(entry.crew_role),
    minimizeRole: shouldMinimizeRoleForExtraRemunerado(entry.operation_type),
  };
}
