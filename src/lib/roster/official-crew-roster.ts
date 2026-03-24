/**
 * Reconhecimento de PDF oficial de escala (nome de arquivo).
 * Não acessa conteúdo interno do portal — apenas convenção de nome permitida pelo produto.
 */

/** Prefixo case-insensitive: CrewRosterReport */
const OFFICIAL_PREFIX = /^crewrosterreport/i;

/**
 * Aceita ex.: CrewRosterReport.pdf, CrewRosterReport_Mar_2026.pdf, crewrosterreport_2026-03.pdf
 */
export function isOfficialCrewRosterFileName(fileName: string): boolean {
  if (!fileName || typeof fileName !== 'string') return false;
  const base = fileName.trim().split(/[/\\]/).pop() ?? '';
  const withoutExt = base.replace(/\.pdf$/i, '');
  return OFFICIAL_PREFIX.test(withoutExt);
}
