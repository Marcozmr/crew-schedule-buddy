/**
 * Lê a última automation_run (ou RUN_ID) no Supabase e imprime diagnóstico objetivo
 * para fechar análise SAML / iFlight / fallbacks.
 *
 * Uso (na raiz do repo ou em services/roster-automation):
 *   npx tsx services/roster-automation/scripts/print-automation-run-diagnostic.mts
 *   $env:AUTOMATION_RUN_ID='uuid'; npx tsx ...
 */
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dirname, '../../../.env') });
loadEnv({ path: path.join(__dirname, '../../.env') });

const STEPS_OF_INTEREST = new Set([
  'sab_crew_header',
  'iflightneo_tile',
  'iflight_navigation',
  'google_saml_403',
  'iflight_fallback_candidates',
  'iflight_fallback_try',
  'iflight_fallback_success',
  'iflight_resolved',
  'iflight_surface',
  'iflight_primary_failed_saml',
  'iflight_close_bad_tab',
  'artifact_saved',
  'iflight_fallback_403',
  'iflight_fallback_nav',
]);

function req(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env: ${name} (copie .env.local para .env ou exporte as variáveis)`);
  return v;
}

const supabaseUrl =
  process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim() || req('SUPABASE_URL');
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || req('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type LogEntry = { at?: string; step?: string; [k: string]: unknown };

function pickLogs(logs: unknown): LogEntry[] {
  if (!Array.isArray(logs)) return [];
  return logs as LogEntry[];
}

function main(): void {
  void (async () => {
    const runIdEnv = process.env.AUTOMATION_RUN_ID?.trim();

    let row: {
      id: string;
      session_id: string;
      user_id: string;
      status: string;
      error_message: string | null;
      step_logs: unknown;
      started_at: string;
      finished_at: string | null;
    } | null = null;

    if (runIdEnv) {
      const { data, error } = await supabase
        .from('automation_runs')
        .select('id, session_id, user_id, status, error_message, step_logs, started_at, finished_at')
        .eq('id', runIdEnv)
        .maybeSingle();
      if (error) throw error;
      row = data as typeof row;
    } else {
      const { data, error } = await supabase
        .from('automation_runs')
        .select('id, session_id, user_id, status, error_message, step_logs, started_at, finished_at')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      row = data as typeof row;
    }

    if (!row) {
      console.log('Nenhuma automation_run encontrada (execute uma ligação/sincronização primeiro).');
      process.exit(0);
    }

    const logs = pickLogs(row.step_logs);
    const filtered = logs.filter((e) => e.step && STEPS_OF_INTEREST.has(String(e.step)));
    const byStep = (name: string) => logs.filter((e) => e.step === name);

    console.log('=== Diagnóstico automation_run ===\n');
    console.log(`run_id:        ${row.id}`);
    console.log(`session_id:    ${row.session_id}`);
    console.log(`status:        ${row.status}`);
    console.log(`started_at:    ${row.started_at}`);
    console.log(`finished_at:   ${row.finished_at ?? '(null)'}`);
    console.log(`error_message: ${row.error_message ?? '(null)'}`);
    console.log('');

    console.log('--- 1) step_logs relevantes (ordem temporal) ---\n');
    const forPrint = logs.filter((e) => e.step && STEPS_OF_INTEREST.has(String(e.step)));
    console.log(JSON.stringify(forPrint.length ? forPrint : logs, null, 2));
    console.log('');

    const tile = byStep('iflightneo_tile').find((e) => e.phase === 'pre_click' || e.hrefFromTile != null);
    const nav = byStep('iflight_navigation')[0];
    const resolved = byStep('iflight_resolved')[0];
    const candidates = byStep('iflight_fallback_candidates')[0];
    const fb403 = logs.filter((e) => e.step === 'iflight_fallback_403');
    const fbOk = byStep('iflight_fallback_success')[0];

    console.log('--- 2) href do tile e URL final após clique ---\n');
    console.log(
      `hrefFromTile (iflightneo_tile): ${tile?.hrefFromTile != null ? JSON.stringify(tile.hrefFromTile) : '(não registado)'}`,
    );
    console.log(`finalUrl (iflight_navigation):  ${nav?.finalUrl != null ? JSON.stringify(nav.finalUrl) : '(não registado)'}`);
    console.log(
      `iflight_resolved.workUrl:       ${resolved && typeof resolved.workUrl === 'string' ? resolved.workUrl : '(não registado)'}`,
    );
    console.log('');

    console.log('--- 3) Candidatos alternativos (iflight_fallback_candidates.sample) ---\n');
    if (candidates?.sample != null) {
      console.log(JSON.stringify(candidates.sample, null, 2));
    } else {
      console.log('(sem entrada — fallback não executado ou run antiga)');
    }
    console.log('');

    console.log('--- 4) Fallback abriu iFlight/escala sem 403? ---\n');
    if (fbOk) {
      console.log('SIM — iflight_fallback_success:', JSON.stringify(fbOk, null, 2));
    } else {
      console.log('Não há iflight_fallback_success nesta run.');
    }
    console.log('');

    console.log('--- 5) Conclusão bloqueio corporativo (Google SAML 403 em todos os caminhos testados) ---\n');
    const hasGoogle403 =
      byStep('google_saml_403').length > 0 ||
      logs.some((e) => e.step === 'google_saml_403') ||
      fb403.length > 0;
    const primaryTile = byStep('iflightneo_tile').length > 0;
    const triedFallback = byStep('iflight_fallback_try').length > 0;

    if (fbOk) {
      console.log(
        'Conclusão: existe pelo menos um caminho alternativo que não terminou em sucesso SAML 403 (ver iflight_fallback_success).',
      );
    } else if (
      hasGoogle403 &&
      triedFallback &&
      typeof candidates?.count === 'number' &&
      fb403.length >= (candidates.count as number)
    ) {
      console.log(
        'Conclusão provável: cada tentativa de fallback registou 403 (ver iflight_fallback_403 vs iflight_fallback_candidates.count).',
      );
    } else if (hasGoogle403 && !fbOk) {
      console.log(
        'Conclusão: ocorreu google_saml_403 (tile ou fallback) e não há fallback bem-sucedido nesta run. ' +
          'Se só existir OAuth Google não configurado para o utilizador, o bloqueio é corporativo (IdP/app), não do EscalaX.',
      );
    } else {
      console.log(
        'Dados insuficientes nesta run para concluir automaticamente (ex.: run incompleta ou sem fallbacks).',
      );
    }

    process.exit(0);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

main();
