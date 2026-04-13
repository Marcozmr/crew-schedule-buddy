import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  runSystemHealthChecks,
  showSystemHealthIndicator,
  type SystemHealthReport,
} from "@/lib/health/healthCheckService";

const POLL_MS = 120_000;

/** Rotas públicas de autenticação — não exibir badge de diagnóstico. */
const PUBLIC_AUTH_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/auth/update-password",
  "/verify-email",
]);

function normalizePathname(pathname: string): string {
  const p = pathname.trim();
  if (!p) return "/";
  const noTrail = p.replace(/\/+$/, "");
  return noTrail === "" ? "/" : noTrail;
}

function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_AUTH_PATHS.has(normalizePathname(pathname));
}

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
 * Em rotas públicas de login/registo não renderiza.
 * Quando todos os checks estão saudáveis, não ocupa espaço na UI (sem ruído visual).
 */
export function SystemHealthIndicator() {
  const location = useLocation();
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

  if (!showSystemHealthIndicator()) return null;
  /** Rotas de login/registo: nunca mostrar o badge (independente de estado do relatório). */
  if (isPublicAuthPath(location.pathname)) return null;
  if (!report) return null;
  if (report.overall === "healthy") return null;

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
