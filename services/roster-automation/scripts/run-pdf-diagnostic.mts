/**
 * Executa diagnóstico LATAM → AIMS/eCrew → RosterReport.aspx (HTML/PDF em disco).
 *
 * Uso (na pasta services/roster-automation):
 *   npm run diagnostic:pdf
 *   npx tsx scripts/run-pdf-diagnostic.mts
 *
 * Env: LATAM_PORTAL_LOGIN_URL; opcional LATAM_ECREW_ENTRY_URL; ROSTER_AUTOMATION_HEADLESS=0 para SSO interativo.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { runLatamPdfDiagnostic, writeDiagnosticReportJson } from '../src/diagnostic/run-latam-pdf-diagnostic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dirname, '../../../.env') });
loadEnv({ path: path.join(__dirname, '../../.env') });

const report = await runLatamPdfDiagnostic();
const jsonPath = await writeDiagnosticReportJson(report);

console.log(
  JSON.stringify(
    {
      conclusion: report.conclusion,
      lastPhase: report.lastPhase,
      detail: report.conclusionDetail,
      reportJson: jsonPath,
      outputDir: report.outputDir,
      screenshots: report.screenshots.length,
      networkHighlights: report.networkHighlights.length,
      ecrewProbe: report.ecrewProbe,
      ecrewNetworkEntries: report.ecrewNetworkLog.length,
    },
    null,
    2,
  ),
);

const ok =
  report.conclusion === 'ecrew_both_saved' ||
  report.conclusion === 'ecrew_html_saved' ||
  report.conclusion === 'ecrew_pdf_saved';
process.exit(ok ? 0 : 2);
