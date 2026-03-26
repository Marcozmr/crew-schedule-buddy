/**
 * Detecção da base operacional a partir da escala importada.
 * Heurística conservadora: sem chute fraco (retorna null).
 */

import type { ScheduleEntry } from '@/hooks/useScheduleData';
import type { DashboardScheduleSourceKind } from '@/lib/roster/dashboard-schedule-consolidation';

/** Origem usada para prioridade portal > pdf > manual_text > inferred */
export type HomeBaseImportSource = 'portal' | 'pdf' | 'manual_text' | 'inferred';

const IATA = /^[A-Z]{3}$/;

export function normalizeAirportIata(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const u = String(raw).trim().toUpperCase();
  if (IATA.test(u)) return u;
  const m = u.match(/\b([A-Z]{3})\b/);
  return m ? m[1] : null;
}

/** Prioridade numérica maior = mais confiável para conflitos entre importações */
export function homeBaseSourcePriority(s: HomeBaseImportSource): number {
  switch (s) {
    case 'portal':
      return 4;
    case 'pdf':
      return 3;
    case 'manual_text':
      return 2;
    case 'inferred':
    default:
      return 1;
  }
}

export function mapDashboardKindToImportSource(kind: DashboardScheduleSourceKind): HomeBaseImportSource {
  switch (kind) {
    case 'portal_automatic':
      return 'portal';
    case 'pdf_official':
    case 'pdf':
      return 'pdf';
    case 'manual':
      return 'manual_text';
    default:
      return 'inferred';
  }
}

export interface InferUserBaseResult {
  base: string | null;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Infere base pelo aeroporto de partida mais frequente nos trechos de voo.
 * Não usa APR/standby como “voo”; apresentação entra só como reforço opcional.
 */
export function inferUserBaseFromEntries(entries: ScheduleEntry[]): InferUserBaseResult {
  const flights = entries.filter((e) => e.is_flight);
  if (flights.length < 2) {
    return { base: null, confidence: 'low' };
  }

  const counts = new Map<string, number>();
  for (const e of flights) {
    const code = normalizeAirportIata(e.departure_airport || e.departure);
    if (!code) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    return { base: null, confidence: 'low' };
  }

  const [top, topCount] = sorted[0];
  const secondCount = sorted[1]?.[1] ?? 0;
  const n = flights.length;

  const pct = topCount / n;
  const dominant = topCount >= Math.ceil(n * 0.42) && topCount - secondCount >= 2;
  const strongLead = topCount >= 3 && topCount - secondCount >= 2;
  const majority = pct >= 0.5 && topCount >= 2;

  if (dominant || strongLead || majority) {
    const conf: 'high' | 'medium' = dominant || majority ? 'high' : 'medium';
    return { base: top, confidence: conf };
  }

  return { base: null, confidence: 'low' };
}

export interface DetectUserBaseFromRosterArgs {
  /** Base explícita no cabeçalho do PDF/roster (imported_rosters.base_airport ou parser) */
  explicitHeaderBase: string | null | undefined;
  entries: ScheduleEntry[];
  /** Fonte da importação ativa (define prioridade vs detecção pura) */
  importSource: HomeBaseImportSource;
}

export interface DetectUserBaseFromRosterResult {
  base: string | null;
  source: HomeBaseImportSource;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Orquestra cabeçalho explícito + inferência. Cabeçalho IATA válido ganha de tudo.
 */
export function detectUserBaseFromRoster(args: DetectUserBaseFromRosterArgs): DetectUserBaseFromRosterResult {
  const explicit = normalizeAirportIata(args.explicitHeaderBase ?? undefined);
  if (explicit) {
    return { base: explicit, source: args.importSource, confidence: 'high' };
  }

  const inferred = inferUserBaseFromEntries(args.entries);
  if (inferred.base && inferred.confidence !== 'low') {
    return {
      base: inferred.base,
      source: 'inferred',
      confidence: inferred.confidence,
    };
  }

  return { base: null, source: args.importSource, confidence: 'low' };
}
