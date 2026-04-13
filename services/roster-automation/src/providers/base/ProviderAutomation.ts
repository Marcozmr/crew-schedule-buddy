/**
 * Contrato futuro para múltiplos fornecedores (LATAM, …).
 * Implementações concretas vivem em `providers/<nome>/`.
 */
export type AutomationProviderId = 'latam';

export interface ProviderAutomationContext {
  userId: string;
  sessionId: string;
  runId: string;
  dataDir: string;
}
