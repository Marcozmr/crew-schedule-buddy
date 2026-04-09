import { reportOperationalEvent } from "@/lib/monitoring/errorReporting";
import {
  aggregateOverallStatus,
  emptyHealthReport,
  failureStatusForCheck,
  fetchWithTimeout,
  HEALTH_CHECK_DEFAULTS,
  isReachableHttpStatus,
  retry,
} from "./healthCheckHelpers";
import type { HealthCheckId, HealthCheckResult, SystemHealthReport } from "./healthCheckTypes";

export type { HealthCheckId, HealthCheckResult, HealthStatus, SystemHealthReport } from "./healthCheckTypes";
export { showSystemHealthIndicator } from "./healthCheckHelpers";

function supabaseBase(): string | null {
  const u = import.meta.env.VITE_SUPABASE_URL?.trim();
  return u ? u.replace(/\/$/, "") : null;
}

function anonKey(): string {
  return (
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
    ""
  );
}

function reportFailures(report: SystemHealthReport): void {
  const sameDetail =
    report.checks.length > 0 && report.checks.every((c) => c.detail === report.checks[0]?.detail);
  if (sameDetail && report.checks[0]?.detail === "missing_supabase_env") {
    reportOperationalEvent("system_health:missing_supabase_env", {
      flow: "system_health",
      extra: { overall: report.overall },
    });
    if (import.meta.env.DEV) console.warn("[system_health] missing_supabase_env");
    return;
  }

  for (const c of report.checks) {
    if (c.status === "healthy") continue;
    reportOperationalEvent(`system_health:${c.id}:${c.status}`, {
      flow: "system_health",
      extra: {
        checkId: c.id,
        status: c.status,
        overall: report.overall,
        latencyMs: c.latencyMs,
        detail: c.detail?.slice(0, 300),
      },
    });
    if (import.meta.env.DEV) {
      console.warn("[system_health]", c.id, c.status, c.detail);
    }
  }
}

async function probeOnce(
  id: HealthCheckId,
  run: () => Promise<HealthCheckResult>,
): Promise<HealthCheckResult> {
  try {
    return await run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { id, status: failureStatusForCheck(id), detail: msg.slice(0, 200) };
  }
}

function probeSupabaseConnection(
  base: string,
  key: string,
  timeoutMs: number,
  attempts: number,
  delayMs: number,
): Promise<HealthCheckResult> {
  const id: HealthCheckId = "supabase_connection";
  return probeOnce(id, async () => {
    const result = await retry(
      async () => {
        const t0 = performance.now();
        const res = await fetchWithTimeout(
          `${base}/rest/v1/`,
          {
            method: "GET",
            headers: { apikey: key, Authorization: `Bearer ${key}` },
          },
          timeoutMs,
        );
        const latencyMs = Math.round(performance.now() - t0);
        if (isReachableHttpStatus(res.status)) {
          return { id, status: "healthy" as const, latencyMs };
        }
        throw new Error(`http_${res.status}`);
      },
      attempts,
      delayMs,
    );
    return result;
  });
}

function probeAuthService(
  base: string,
  key: string,
  timeoutMs: number,
  attempts: number,
  delayMs: number,
): Promise<HealthCheckResult> {
  const id: HealthCheckId = "auth_service";
  return probeOnce(id, async () => {
    const result = await retry(
      async () => {
        const t0 = performance.now();
        let res = await fetchWithTimeout(
          `${base}/auth/v1/health`,
          { method: "GET", headers: { apikey: key, Authorization: `Bearer ${key}` } },
          timeoutMs,
        );
        if (!res.ok) {
          res = await fetchWithTimeout(
            `${base}/auth/v1/settings`,
            { method: "GET", headers: { apikey: key, Authorization: `Bearer ${key}` } },
            timeoutMs,
          );
        }
        const latencyMs = Math.round(performance.now() - t0);
        if (res.ok) {
          return { id, status: "healthy" as const, latencyMs };
        }
        throw new Error(`auth_http_${res.status}`);
      },
      attempts,
      delayMs,
    );
    return result;
  });
}

/**
 * OPTIONS nas funções essenciais (sem corpo, sem custo de negócio).
 * auth-rate-limit + send-support-email (email/support).
 */
function probeEdgeFunctions(
  base: string,
  timeoutMs: number,
  attempts: number,
  delayMs: number,
): Promise<HealthCheckResult> {
  const id: HealthCheckId = "edge_functions";
  return probeOnce(id, async () => {
    const result = await retry(
      async () => {
        const t0 = performance.now();
        const urls = [
          `${base}/functions/v1/auth-rate-limit`,
          `${base}/functions/v1/send-support-email`,
        ];
        const responses = await Promise.all(
          urls.map((url) => fetchWithTimeout(url, { method: "OPTIONS" }, timeoutMs)),
        );
        const latencyMs = Math.round(performance.now() - t0);
        const oks = responses.map((r) => r.ok);
        const okCount = oks.filter(Boolean).length;
        if (okCount === 2) {
          return { id, status: "healthy" as const, latencyMs };
        }
        if (okCount === 1) {
          return {
            id,
            status: "degraded" as const,
            latencyMs,
            detail: "partial_edge_options",
          };
        }
        throw new Error("edge_options_failed");
      },
      attempts,
      delayMs,
    );
    return result;
  });
}

/**
 * Rota do Flight Board (enriquecimento) — OPTIONS confirma deploy/CORS; OpenSky só em pedidos reais autenticados.
 */
function probeFlightDataProvider(
  base: string,
  timeoutMs: number,
  attempts: number,
  delayMs: number,
): Promise<HealthCheckResult> {
  const id: HealthCheckId = "flight_data_provider";
  return probeOnce(id, async () => {
    const result = await retry(
      async () => {
        const t0 = performance.now();
        const res = await fetchWithTimeout(
          `${base}/functions/v1/flight-status`,
          { method: "OPTIONS" },
          timeoutMs,
        );
        const latencyMs = Math.round(performance.now() - t0);
        if (res.ok) {
          return { id, status: "healthy" as const, latencyMs };
        }
        throw new Error(`flight_status_options_${res.status}`);
      },
      attempts,
      delayMs,
    );
    return result;
  });
}

/**
 * Executa probes em paralelo (rápido), com timeout e retry por check.
 * Nunca lança — falhas devolvem relatório degradado.
 */
export async function runSystemHealthChecks(): Promise<SystemHealthReport> {
  try {
    const base = supabaseBase();
    const key = anonKey();
    if (!base || !key) {
      const report = emptyHealthReport("missing_supabase_env");
      reportFailures(report);
      return report;
    }

    const { timeoutMs, retryAttempts, retryDelayMs } = HEALTH_CHECK_DEFAULTS;

    const checks = await Promise.all([
      probeSupabaseConnection(base, key, timeoutMs, retryAttempts, retryDelayMs),
      probeAuthService(base, key, timeoutMs, retryAttempts, retryDelayMs),
      probeEdgeFunctions(base, timeoutMs, retryAttempts, retryDelayMs),
      probeFlightDataProvider(base, timeoutMs, retryAttempts, retryDelayMs),
    ]);

    const report: SystemHealthReport = {
      overall: aggregateOverallStatus(checks),
      checkedAt: new Date().toISOString(),
      checks,
    };
    reportFailures(report);
    return report;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const report = emptyHealthReport(msg);
    reportFailures(report);
    return report;
  }
}
