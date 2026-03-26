/**
 * Fusos operacionais do app: valor persistido = IANA; UI = apenas rótulos amigáveis.
 */

export const OPERATIONAL_TIMEZONE_OPTIONS = [
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
  { value: 'America/Manaus', label: 'Manaus (AMT)' },
  { value: 'America/Belem', label: 'Belém (BRT)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (AMT)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (ACT)' },
] as const;

const KNOWN = new Set(OPERATIONAL_TIMEZONE_OPTIONS.map((o) => o.value));

export function isKnownOperationalTimezone(iana: string | null | undefined): boolean {
  const v = (iana ?? '').trim();
  return v !== '' && KNOWN.has(v);
}

/** Rótulo para UI; nunca expõe o identificador IANA. */
export function getTimezoneLabel(iana: string | null | undefined): string {
  const v = (iana ?? '').trim();
  if (!v) return '—';
  const row = OPERATIONAL_TIMEZONE_OPTIONS.find((o) => o.value === v);
  if (row) return row.label;
  return 'Fuso personalizado';
}
