/**
 * EscalaX Regulation Engine — Alerts Engine
 * 
 * Transforms raw RuleResults into structured, prioritized alerts
 * for consumption by UI or external systems.
 */

import type { RuleResult, AlertCode, Severity, ComplianceStatus } from './types';

export interface StructuredAlert {
  code: AlertCode;
  severity: Severity;
  title: string;
  message: string;
  ruleId: string;
  ruleSource: string;
  context?: Record<string, unknown>;
}

const ALERT_TITLES: Record<AlertCode, string> = {
  DUTY_EXCEEDED: 'Jornada Excedida',
  REST_INSUFFICIENT: 'Repouso Insuficiente',
  FATIGUE_RISK: 'Risco de Fadiga',
  WOCL_EXPOSURE: 'Exposição ao WOCL',
  GROUND_TIME_EXCEEDED: 'Tempo de Solo Excedido',
  MADRUGADA_LIMIT_EXCEEDED: 'Limite de Madrugadas Excedido',
  FLIGHT_HOURS_EXCEEDED: 'Horas de Voo Excedidas',
  CONSECUTIVE_EARLY_STARTS: 'Apresentações Consecutivas de Madrugada',
  CONSECUTIVE_NIGHT_DUTIES: 'Jornadas Noturnas Consecutivas',
  STANDBY_LIMIT_EXCEEDED: 'Limite de Sobreaviso Excedido',
  WEEKLY_REST_INSUFFICIENT: 'Repouso Semanal Insuficiente',
};

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

/**
 * Convert failed rule results into structured, sorted alerts.
 */
export function buildAlerts(failedRules: RuleResult[]): StructuredAlert[] {
  return failedRules
    .filter(r => !r.passed && r.alertCode)
    .map(r => ({
      code: r.alertCode!,
      severity: r.severity,
      title: ALERT_TITLES[r.alertCode!] || r.alertCode!,
      message: r.message,
      ruleId: r.ruleId,
      ruleSource: r.ruleSource,
      context: r.context,
    }))
    .sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
}

/**
 * Determine overall compliance status from rule results.
 */
export function determineComplianceStatus(rules: RuleResult[], fatigueScore: number): ComplianceStatus {
  const hasCritical = rules.some(r => !r.passed && r.severity === 'critical');
  const hasWarning = rules.some(r => !r.passed && r.severity === 'warning');

  if (fatigueScore >= 80) return 'CRITICAL_FATIGUE';
  if (hasCritical) return 'NON_COMPLIANT';
  if (hasWarning) return 'WARNING';
  return 'COMPLIANT';
}
