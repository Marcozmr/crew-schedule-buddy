import type { HealthCheckId, HealthCheckResult, HealthStatus, SystemHealthReport } from "./healthCheckTypes";

const DEFAULT_TIMEOUT_MS = 8_000;
const RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 400;

export const HEALTH_CHECK_DEFAULTS = {
  timeoutMs: DEFAULT_TIMEOUT_MS,
  retryAttempts: RETRY_ATTEMPTS,
  retryDelayMs: RETRY_DELAY_MS,
} as const;

/** Apenas DEV ou flag explícita — não exibir a utilizadores finais. */
export function showSystemHealthIndicator(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_SYSTEM_HEALTH_INDICATOR === "true";
}

export function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

/**
 * Retry simples (sem backoff exponencial) — adequado a probes leves.
 */
export async function retry<T>(fn: () => Promise<T>, attempts: number, delayMs: number): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw last;
}

export function isReachableHttpStatus(status: number): boolean {
  return (status >= 200 && status < 300) || status === 404 || status === 406;
}

export function failureStatusForCheck(id: HealthCheckId): HealthStatus {
  if (id === "supabase_connection" || id === "auth_service") return "down";
  return "degraded";
}

/**
 * Corpo típico de `GET /health` do worker `services/roster-automation` (`{ "ok": true }`).
 * Aceita também `{ "status": "ok" }` para compatibilidade.
 */
export function isHealthyAutomationHealthJson(body: unknown): boolean {
  if (body === null || typeof body !== "object") return false;
  const o = body as Record<string, unknown>;
  if (o.ok === true) return true;
  if (typeof o.status === "string" && o.status.toLowerCase() === "ok") return true;
  return false;
}

export function aggregateOverallStatus(checks: HealthCheckResult[]): HealthStatus {
  if (checks.some((c) => c.status === "down")) return "down";
  if (checks.some((c) => c.status === "degraded")) return "degraded";
  return "healthy";
}

export function emptyHealthReport(detail: string): SystemHealthReport {
  return {
    overall: "degraded",
    checkedAt: new Date().toISOString(),
    checks: [
      { id: "supabase_connection", status: "degraded", detail },
      { id: "auth_service", status: "degraded", detail },
      { id: "edge_functions", status: "degraded", detail },
      { id: "flight_data_provider", status: "degraded", detail },
    ],
  };
}
