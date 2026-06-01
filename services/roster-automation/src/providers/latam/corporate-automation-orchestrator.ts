/**
 * Orquestrador central: persistência FSM + snapshot, coordenação com status legacy em BD.
 */
import { getServiceClient } from '../../db.js';
import type { CorporateFsmState, OrchestrationSnapshot } from './fsm-types.js';
import { mapFsmToDbStatus } from './fsm-types.js';

export async function persistFsmTransition(params: {
  runId: string;
  sessionId: string;
  fsm: CorporateFsmState;
  snapshot?: Partial<OrchestrationSnapshot>;
  /** Atualiza last_success_fsm_state (marcos concluídos). */
  markSuccess?: boolean;
  /** Execução terminada (preenche finished_at na linha do run). */
  finished?: boolean;
  /** Mensagem em `automation_sessions.last_error` (falhas / MFA). */
  lastError?: string | null;
}): Promise<void> {
  const { runId, sessionId, fsm, snapshot = {}, markSuccess, finished, lastError } = params;
  const supabase = getServiceClient();

  const { data: row } = await supabase.from('automation_runs').select('orchestration_snapshot').eq('id', runId).single();
  const prev = (row as { orchestration_snapshot?: OrchestrationSnapshot } | null)?.orchestration_snapshot ?? {};
  const merged: OrchestrationSnapshot = { ...prev, ...snapshot };

  const dbStatus = mapFsmToDbStatus(fsm);
  const patch: Record<string, unknown> = {
    fsm_state: fsm,
    orchestration_snapshot: merged,
    status: dbStatus,
    updated_at: new Date().toISOString(),
  };
  if (markSuccess) patch.last_success_fsm_state = fsm;
  if (finished) patch.finished_at = new Date().toISOString();

  await supabase.from('automation_runs').update(patch).eq('id', runId);
  await supabase
    .from('automation_sessions')
    .update({
      status: dbStatus,
      last_error: lastError !== undefined ? lastError : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
}

/** Apenas snapshot (URL/host) sem mudar FSM — para pollers SSO. */
export async function patchOrchestrationSnapshot(
  runId: string,
  snapshot: Partial<OrchestrationSnapshot>,
): Promise<void> {
  const supabase = getServiceClient();
  const { data: row } = await supabase.from('automation_runs').select('orchestration_snapshot').eq('id', runId).single();
  const prev = (row as { orchestration_snapshot?: OrchestrationSnapshot } | null)?.orchestration_snapshot ?? {};
  await supabase
    .from('automation_runs')
    .update({
      orchestration_snapshot: { ...prev, ...snapshot },
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId);
}
