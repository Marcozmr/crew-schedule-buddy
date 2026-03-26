/**
 * Exibição compacta de situação e função: prioriza siglas oficiais do roster/PDF.
 * Sem conversões genéricas (ex.: OP→TRIP, CC→AUX).
 */

import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { resolveCrewStatusFromFlightOperation } from '@/lib/roster/crew-status-labels';

/** Texto curto alfanumérico típico de sigla no PDF (sem frases como "Tripulando"). */
export function looksLikeRosterSigla(s: string): boolean {
  const t = s.trim();
  if (!t || t.length > 8) return false;
  if (/\s/.test(t)) return false;
  return /^[A-Za-z0-9\-/]+$/.test(t);
}

/**
 * Último recurso quando não há código no roster — abreviação mecânica (sem mapa semântico).
 */
export function fallbackSituationFromLongText(label: string): string {
  const raw = label.trim();
  if (!raw) return '—';
  if (looksLikeRosterSigla(raw)) return raw;
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].replace(/\s+/g, '').toUpperCase().slice(0, 6);
  }
  return words
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 6);
}

export function fallbackRoleFromFriendlyLabel(label: string): string {
  const raw = label.trim();
  if (!raw || raw === '—') return '—';
  if (looksLikeRosterSigla(raw)) return raw;
  return raw.replace(/\s+/g, '').toUpperCase().slice(0, 6);
}

/** Situação/função com valor real para exibir (sem placeholder vazio ou «—»). */
export function isDisplayableCrewSigla(value: string | null | undefined): boolean {
  const t = (value ?? '').trim();
  return t !== '' && t !== '—';
}

/** Situação: sigla exatamente como no roster quando disponível. */
export function resolveRosterSituationSigla(leg: ScheduleEntry): string {
  const code = leg.crew_status_code?.trim();
  if (code) return code;

  if (leg.is_flight) {
    const op = leg.operation_type?.trim();
    if (op) return op;
  }

  const statusLabel = leg.crew_status_label?.trim();
  if (statusLabel && looksLikeRosterSigla(statusLabel)) return statusLabel;

  const activityLabel = leg.activity_label?.trim();
  if (activityLabel && looksLikeRosterSigla(activityLabel)) return activityLabel;

  const raw = resolveLegSituationRaw(leg);
  if (raw !== '—') return fallbackSituationFromLongText(raw);
  return '—';
}

/** Função: sigla exatamente como no roster (ex.: CC, PUR, CA). */
export function resolveRosterRoleSigla(leg: ScheduleEntry): string {
  const r = leg.crew_role?.trim();
  if (r) return r;
  return '—';
}

export function resolveLegSituationRaw(leg: ScheduleEntry): string {
  if (leg.crew_status_label?.trim()) return leg.crew_status_label.trim();
  if (leg.is_flight && leg.operation_type) {
    return resolveCrewStatusFromFlightOperation(leg.operation_type).label;
  }
  if (leg.activity_label?.trim()) return leg.activity_label.trim();
  return '—';
}

export function buildCrewAbbrevPairFromLeg(leg: ScheduleEntry): { situation: string; role: string } {
  return {
    situation: resolveRosterSituationSigla(leg),
    role: resolveRosterRoleSigla(leg),
  };
}
