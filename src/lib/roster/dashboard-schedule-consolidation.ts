/**
 * Consolidação manual × automática × PDF para o dashboard / Flight Board Pro.
 * Prioridade: portal/sincronizado > PDF (oficial > corporativo) > manual.
 * Não altera o banco — apenas escolhe qual `imported_rosters.id` deve alimentar a UI.
 */

export type DashboardScheduleSourceKind =
  | 'portal_automatic'
  | 'pdf_official'
  | 'pdf'
  | 'manual'
  | 'unknown';

export interface ImportedRosterForDashboardPick {
  id: string;
  is_active: boolean;
  inserted_count: number | null;
  parsed_count: number | null;
  import_status: string | null;
  roster_provider?: string | null;
  source_type?: string | null;
  roster_source?: string | null;
  import_origin?: string | null;
  portal_connection_id?: string | null;
  connector_key?: string | null;
  synced_at?: string | null;
  last_sync_at?: string | null;
  is_official_crew_roster_pdf?: boolean | null;
  superseded_by_roster_id?: string | null;
  created_at: string;
}

/** Maior número = fonte preferida para o painel principal. */
export function rosterSourcePriorityScore(row: ImportedRosterForDashboardPick): number {
  const tier = classifyDashboardRosterSource(row);
  const base =
    tier === 'portal_automatic'
      ? 1_000_000
      : tier === 'pdf_official'
        ? 800_000
        : tier === 'pdf'
          ? 600_000
          : tier === 'manual'
            ? 400_000
            : 500_000;

  const inserted = row.inserted_count ?? 0;
  const parsed = row.parsed_count ?? 0;
  const dataBonus = Math.min(50_000, (inserted + parsed) * 10);

  const t = Date.parse(row.synced_at || row.last_sync_at || row.created_at) || 0;
  const recency = Math.min(10_000, Math.floor(t / 100_000)); // micro-tiebreak

  const activeBonus = row.is_active ? 25_000 : 0;

  return base + dataBonus + recency + activeBonus;
}

export function classifyDashboardRosterSource(
  row: ImportedRosterForDashboardPick
): DashboardScheduleSourceKind {
  if (row.portal_connection_id) return 'portal_automatic';

  const rp = (row.roster_provider || '').toLowerCase();
  const st = (row.source_type || '').toLowerCase();
  const io = (row.import_origin || '').toLowerCase();
  const rs = (row.roster_source || '').toLowerCase();
  const ck = (row.connector_key || '').toLowerCase();

  if (
    rp.includes('portal') ||
    st.includes('portal') ||
    io.includes('portal') ||
    rs.includes('portal') ||
    ck.includes('portal') ||
    rp === 'corporate_portal' ||
    st === 'corporate_portal'
  ) {
    return 'portal_automatic';
  }

  if (row.is_official_crew_roster_pdf || st === 'official_pdf') return 'pdf_official';
  if (rp === 'pdf' || st === 'pdf') return 'pdf';
  if (rp === 'manual' || io === 'manual') return 'manual';
  return 'unknown';
}

export function rosterHasScheduleRows(row: ImportedRosterForDashboardPick): boolean {
  const ins = row.inserted_count ?? 0;
  const par = row.parsed_count ?? 0;
  return ins > 0 || par > 0;
}

/**
 * Escolhe o roster que deve alimentar o dashboard.
 * Se houver fonte de maior prioridade com linhas na escala, ela vence.
 * Se só existirem rosters vazios, mantém o melhor candidato por prioridade (evita painel cego).
 */
export function pickDashboardRosterId(
  rows: ImportedRosterForDashboardPick[]
): string | null {
  if (!rows.length) return null;

  const notSuperseded = rows.filter((r) => !r.superseded_by_roster_id);
  const pool = notSuperseded.length ? notSuperseded : rows;

  const withData = pool.filter(rosterHasScheduleRows);
  const ranked = (withData.length ? withData : pool).slice();

  ranked.sort((a, b) => rosterSourcePriorityScore(b) - rosterSourcePriorityScore(a));
  return ranked[0]?.id ?? null;
}

export function dashboardSourceLabel(kind: DashboardScheduleSourceKind): string {
  switch (kind) {
    case 'portal_automatic':
      return 'Portal / automática';
    case 'pdf_official':
      return 'PDF oficial';
    case 'pdf':
      return 'PDF';
    case 'manual':
      return 'Manual';
    default:
      return 'Escala';
  }
}
