/**
 * Siglas operacionais da escala (CrewRoster / linha de voo) → rótulos em português.
 * Camada única para badges, tooltips e legenda.
 */

export type OperationalCodeId = 'CC' | 'CCM' | 'PS' | 'OP';

export type OperationalCodeCategory = 'cabin_role' | 'passenger_status' | 'operational_state';

export interface OperationalCodeDefinition {
  id: OperationalCodeId;
  shortLabel: string;
  fullLabel: string;
  category: OperationalCodeCategory;
}

/** Ordem de detecção: códigos mais longos primeiro (ex.: CCM antes de CC). */
export const OPERATIONAL_CODES_ORDER: OperationalCodeId[] = ['CCM', 'CC', 'PS', 'OP'];

export const OPERATIONAL_CODE_MAP: Record<OperationalCodeId, OperationalCodeDefinition> = {
  CC: {
    id: 'CC',
    shortLabel: 'CC',
    fullLabel: 'Comissário auxiliar',
    category: 'cabin_role',
  },
  CCM: {
    id: 'CCM',
    shortLabel: 'CCM',
    fullLabel: 'Chefe de cabine',
    category: 'cabin_role',
  },
  PS: {
    id: 'PS',
    shortLabel: 'PS',
    fullLabel: 'Passenger extra remunerado',
    category: 'passenger_status',
  },
  OP: {
    id: 'OP',
    shortLabel: 'OP',
    fullLabel: 'Operando',
    category: 'operational_state',
  },
};

const CODE_REGEX = new RegExp(
  `\\b(${OPERATIONAL_CODES_ORDER.join('|')})\\b`,
  'gi'
);

/**
 * Extrai códigos conhecidos de textos livres da escala (função, atribuição, comentário, linha bruta).
 */
export function extractOperationalCodesFromText(...parts: (string | null | undefined)[]): OperationalCodeId[] {
  const blob = parts.filter(Boolean).join(' ');
  if (!blob.trim()) return [];

  const seen = new Set<OperationalCodeId>();
  const matches = blob.match(CODE_REGEX);
  if (!matches) return [];

  for (const m of matches) {
    const upper = m.toUpperCase() as OperationalCodeId;
    if (upper in OPERATIONAL_CODE_MAP && !seen.has(upper)) {
      seen.add(upper);
    }
  }

  return OPERATIONAL_CODES_ORDER.filter((id) => seen.has(id));
}

export function formatOperationalBadgeLine(code: OperationalCodeId): string {
  const def = OPERATIONAL_CODE_MAP[code];
  return `${def.shortLabel} · ${def.fullLabel}`;
}

/** Campos típicos de schedule_entries onde siglas podem aparecer. */
export function extractOperationalCodesFromScheduleEntry(entry: {
  crew_role: string | null;
  assignment: string | null;
  operation_type: string | null;
  comments: string | null;
  raw_line: string | null;
  pairing_code: string | null;
}): OperationalCodeId[] {
  return extractOperationalCodesFromText(
    entry.crew_role,
    entry.assignment,
    entry.operation_type,
    entry.comments,
    entry.raw_line,
    entry.pairing_code
  );
}
