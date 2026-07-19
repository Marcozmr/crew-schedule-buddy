/**
 * Sinal de cancelamento em memória para runs em curso (por processo — não sobrevive a restart,
 * o que é aceitável: um restart já mata o Chromium em memória e o run deve ser tratado como morto).
 */
const cancelledRuns = new Set<string>();

export function requestCancelRun(runId: string): void {
  cancelledRuns.add(runId);
}

export function isRunCancelled(runId: string): boolean {
  return cancelledRuns.has(runId);
}

export function clearCancelledRun(runId: string): void {
  cancelledRuns.delete(runId);
}
