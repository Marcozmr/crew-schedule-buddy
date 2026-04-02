import * as Sentry from "@sentry/react";
import { getEscalaxBuildId } from "@/lib/build-id";
import { classifyAuthRelatedError, type AuthErrorKind } from "./authErrorClassification";

const SENSITIVE_KEY = /password|token|secret|authorization|cookie|refresh|access.?token|bearer|apikey|api_key/i;
const EMAIL_LIKE_KEY = /^email$/i;

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** Remove chaves que possam conter PII ou segredos antes de `setContext`. */
export function sanitizeExtra(extra: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(extra)) {
    if (EMAIL_LIKE_KEY.test(k)) {
      out[k] = "[redacted]";
      continue;
    }
    if (SENSITIVE_KEY.test(k)) {
      out[k] = "[redacted]";
      continue;
    }
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sanitizeExtra(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function isErrorReportingEnabled(): boolean {
  return Boolean(import.meta.env.VITE_SENTRY_DSN?.trim());
}

export function reportUnexpectedError(
  error: unknown,
  context: { flow: string; extra?: Record<string, unknown> },
): void {
  if (!isErrorReportingEnabled()) return;
  const err = error instanceof Error ? error : new Error(String(error));
  Sentry.withScope((scope) => {
    scope.setTag("flow", context.flow);
    scope.setTag("error_kind", "unexpected");
    scope.setLevel("error");
    scope.setContext("escalax", {
      build_id: getEscalaxBuildId(),
      flow: context.flow,
    });
    if (context.extra) {
      scope.setContext("flow", sanitizeExtra(context.extra));
    }
    Sentry.captureException(err);
  });
}

/**
 * Evento operacional esperado (volume controlado). Nível info — não usar para falhas de rede ou bugs.
 */
export function reportOperationalEvent(
  message: string,
  context: { flow: string; extra?: Record<string, unknown> },
): void {
  if (!isErrorReportingEnabled()) return;
  Sentry.withScope((scope) => {
    scope.setTag("flow", context.flow);
    scope.setTag("error_kind", "operational");
    scope.setLevel("info");
    if (context.extra) {
      scope.setContext("flow", sanitizeExtra(context.extra));
    }
    Sentry.captureMessage(message, "info");
  });
}

export function reportAuthFlowFailure(
  flow: string,
  err: unknown,
  extra?: Record<string, unknown>,
): void {
  const kind = classifyAuthRelatedError(err);
  if (kind === "operational") return;
  const authCode =
    err && typeof err === "object" && "code" in err && typeof (err as { code?: unknown }).code === "string"
      ? (err as { code: string }).code
      : undefined;
  reportUnexpectedError(err, {
    flow,
    extra: { ...extra, auth_error_code: authCode },
  });
}

export function reportAuthFlowOutcome(
  flow: string,
  err: unknown,
  extra?: Record<string, unknown>,
): AuthErrorKind {
  const kind = classifyAuthRelatedError(err);
  if (kind === "unexpected") {
    reportUnexpectedError(err, { flow, extra });
  }
  return kind;
}

export function reportReactBoundaryError(
  error: Error,
  context: { boundary: "app" | "route"; scope?: string; componentStack?: string },
): void {
  if (!isErrorReportingEnabled()) return;
  Sentry.withScope((scope) => {
    scope.setTag("boundary", context.boundary);
    if (context.scope) scope.setTag("boundary_scope", context.scope);
    scope.setLevel("error");
    if (context.componentStack) {
      scope.setContext("react", { componentStack: truncate(context.componentStack, 2000) });
    }
    Sentry.captureException(error);
  });
}

export function reportSupportFlowResult(
  outcome: string,
  _userMessage: string,
  extra?: Record<string, unknown>,
): void {
  if (!isErrorReportingEnabled()) return;
  const needsEngineering = outcome === "invoke_error" || outcome === "internal_error";
  if (!needsEngineering) return;
  reportUnexpectedError(new Error(`support:${outcome}`), {
    flow: "support_submit",
    extra: { outcome, ...extra },
  });
}
