/**
 * Tipos do relatório de diagnóstico LATAM → AIMS/eCrew → RosterReport (HTML/PDF).
 */
import type { EcrewNetworkEntry } from '../providers/latam/ecrew-network.js';
import type { EcrewRosterProbe } from '../providers/latam/ecrew-roster-flow.js';

export type DiagnosticConclusion =
  | 'ecrew_both_saved'
  | 'ecrew_html_saved'
  | 'ecrew_pdf_saved'
  | 'ecrew_not_reached'
  | 'ecrew_my_schedule_missing'
  | 'ecrew_print_missing'
  | 'ecrew_print_no_export'
  | 'ecrew_roster_seen_not_saved'
  | 'auth_timeout'
  | 'session_lost_after_sso'
  | 'stuck_intermediate_navigation'
  /** Config ausente ou exceção não mapeada */
  | 'error';

export interface TrailEntry {
  at: string;
  phase: string;
  url: string;
  title: string;
  host: string;
  path: string;
  note?: string;
}

export interface PageEventEntry {
  at: string;
  kind: 'context_page_added' | 'popup' | 'main_nav';
  url: string;
}

export interface NetworkHighlight {
  at: string;
  direction: 'request' | 'response';
  method?: string;
  url: string;
  status?: number;
  contentType?: string;
  reason: string;
}

export interface PdfCandidate {
  at: string;
  kind: 'download_suggested' | 'response_pdf' | 'url_pdf' | 'blob_hint' | 'attachment_header';
  detail: string;
}

export interface LatamPdfDiagnosticReport {
  startedAt: string;
  finishedAt: string;
  outputDir: string;
  conclusion: DiagnosticConclusion;
  conclusionDetail: string;
  trail: TrailEntry[];
  pageEvents: PageEventEntry[];
  networkHighlights: NetworkHighlight[];
  pdfCandidates: PdfCandidate[];
  screenshots: string[];
  lastPhase: string;
  error?: string;
  /** Prioridade AIMS/eCrew: sinais objetivos por etapa. */
  ecrewProbe: EcrewRosterProbe;
  /** Rede filtrada ecrew / RosterReport / export. */
  ecrewNetworkLog: EcrewNetworkEntry[];
}
