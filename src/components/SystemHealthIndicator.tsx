import { useEffect, useState } from "react";
import {
  runSystemHealthChecks,
  showSystemHealthIndicator,
  type SystemHealthReport,
} from "@/lib/health/healthCheckService";

const POLL_MS = 120_000;

function statusLabel(overall: SystemHealthReport["overall"]): string {
  if (overall === "healthy") return "OK";
  if (overall === "degraded") return "Degradado";
  return "Indisponível";
}

function statusClass(overall: SystemHealthReport["overall"]): string {
  if (overall === "healthy") return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200";
  if (overall === "degraded") return "border-amber-500/40 bg-amber-500/15 text-amber-100";
  return "border-red-500/40 bg-red-500/15 text-red-100";
}

/**
 * Indicador opcional (só DEV ou `VITE_SYSTEM_HEALTH_INDICATOR=true`).
 * Corre probes em background — não bloqueia a UI.
 */
export function SystemHealthIndicator() {
  const [report, setReport] = useState<SystemHealthReport | null>(null);

  useEffect(() => {
    if (!showSystemHealthIndicator()) return;

    let cancelled = false;

    const tick = () => {
      queueMicrotask(async () => {
        try {
          const r = await runSystemHealthChecks();
          if (!cancelled) setReport(r);
        } catch {
          /* runSystemHealthChecks não deve lançar; defensivo */
        }
      });
    };

    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (!showSystemHealthIndicator() || !report) return null;

  const title = report.checks
    .map((c) => `${c.id}: ${c.status}${c.detail ? ` (${c.detail})` : ""}`)
    .join("\n");

  return (
    <div
      className={`pointer-events-none fixed bottom-3 right-3 z-[100] max-w-[min(100vw-1.5rem,20rem)] rounded-md border px-2 py-1 font-mono text-[10px] leading-tight shadow-md backdrop-blur-sm ${statusClass(report.overall)}`}
      title={title}
      role="status"
      aria-live="polite"
    >
      <span className="opacity-90">Health</span>{" "}
      <span className="font-semibold">{statusLabel(report.overall)}</span>
      <span className="ml-1 opacity-75">
        {new Date(report.checkedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}
