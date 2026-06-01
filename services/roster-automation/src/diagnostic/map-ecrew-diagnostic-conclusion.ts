/**
 * Mapeia o estado do probe AIMS/eCrew para conclusão objetiva do relatório local.
 */
import type { DiagnosticConclusion } from './latam-pdf-diagnostic-types.js';
import type { EcrewRosterProbe } from '../providers/latam/ecrew-roster-flow.js';

export function mapEcrewProbeToConclusion(
  probe: EcrewRosterProbe,
  authed: boolean,
): { conclusion: DiagnosticConclusion; conclusionDetail: string } {
  if (!authed) {
    return {
      conclusion: 'auth_timeout',
      conclusionDetail: 'Sessão pós-SSO não confirmada (expectAuthenticatedHome / prazo)',
    };
  }

  if (!probe.reachedEcrew) {
    return {
      conclusion: 'ecrew_not_reached',
      conclusionDetail: probe.lastError || 'Não foi possível alcançar URL com /ecrew/ (entrada, link ou timeout)',
    };
  }

  const hasHtml = Boolean(probe.htmlSavedPath);
  const hasPdf = Boolean(probe.pdfSavedPath);

  if (hasHtml && hasPdf) {
    return {
      conclusion: 'ecrew_both_saved',
      conclusionDetail: `HTML: ${probe.htmlSavedPath}; PDF: ${probe.pdfSavedPath}`,
    };
  }
  if (hasHtml) {
    return {
      conclusion: 'ecrew_html_saved',
      conclusionDetail: `HTML gravado: ${probe.htmlSavedPath}`,
    };
  }
  if (hasPdf) {
    return {
      conclusion: 'ecrew_pdf_saved',
      conclusionDetail: `PDF gravado: ${probe.pdfSavedPath}`,
    };
  }

  if (probe.failedAt === 'my_schedule') {
    return {
      conclusion: 'ecrew_my_schedule_missing',
      conclusionDetail: 'Em eCrew: My Schedule não encontrado ou não aberto',
    };
  }
  if (probe.failedAt === 'print') {
    return {
      conclusion: 'ecrew_print_missing',
      conclusionDetail: 'My Schedule ok ou superfície de escala, mas Print não encontrado',
    };
  }
  if (probe.rosterReportAspxSeen) {
    return {
      conclusion: 'ecrew_roster_seen_not_saved',
      conclusionDetail:
        'RosterReport.aspx visto na rede/URL mas ficheiros não gravados — ver ecrewNetworkLog e screenshots',
    };
  }
  if (probe.printClicked) {
    return {
      conclusion: 'ecrew_print_no_export',
      conclusionDetail: 'Print acionado sem captura de HTML/PDF nem URL RosterReport persistida',
    };
  }

  if (probe.failedAt === 'export_or_save') {
    if (probe.rosterReportAspxSeen) {
      return {
        conclusion: 'ecrew_roster_seen_not_saved',
        conclusionDetail:
          probe.lastError || 'RosterReport.aspx referenciado mas GET/UI não gravaram HTML/PDF — ver rede',
      };
    }
    return {
      conclusion: 'stuck_intermediate_navigation',
      conclusionDetail:
        probe.lastError || 'Sem captura: GET direto falhou e UI não completou exportação — ver ecrewNetworkLog',
    };
  }

  return {
    conclusion: 'stuck_intermediate_navigation',
    conclusionDetail: probe.lastError || 'Estado intermédio sem classificação específica',
  };
}
