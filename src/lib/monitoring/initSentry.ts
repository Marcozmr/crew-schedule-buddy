import * as Sentry from "@sentry/react";
import type { ErrorEvent } from "@sentry/core";
import { getEscalaxBuildId } from "@/lib/build-id";

function parseRate(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}

function scrubUrl(u: string | undefined): string | undefined {
  if (!u) return u;
  try {
    const parsed = new URL(u, typeof window !== "undefined" ? window.location.origin : "https://localhost");
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "[invalid_url]";
  }
}

function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.request?.url) {
    event.request = { ...event.request, url: scrubUrl(event.request.url) };
  }
  if (event.transaction) {
    event.transaction = scrubUrl(event.transaction) ?? event.transaction;
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => {
      if (b.data && typeof b.data === "object" && "url" in b.data && typeof (b.data as { url?: string }).url === "string") {
        return {
          ...b,
          data: {
            ...(b.data as object),
            url: scrubUrl((b.data as { url: string }).url),
          },
        };
      }
      return b;
    });
  }
  return event;
}

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn) return;

  const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE;
  const tracesSampleRate = parseRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE, 0);
  const replaysSessionSampleRate = parseRate(import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE, 0);
  const replaysOnErrorSampleRate = parseRate(import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE, 1);

  const integrations: NonNullable<Parameters<typeof Sentry.init>[0]["integrations"]> = [];
  if (tracesSampleRate > 0) {
    integrations.push(Sentry.browserTracingIntegration());
  }
  if (replaysSessionSampleRate > 0 || replaysOnErrorSampleRate > 0) {
    integrations.push(
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    );
  }

  Sentry.init({
    dsn,
    environment,
    release: `escalax@${getEscalaxBuildId()}`,
    sendDefaultPii: false,
    integrations: integrations.length > 0 ? integrations : undefined,
    tracesSampleRate,
    replaysSessionSampleRate,
    replaysOnErrorSampleRate,
    ignoreErrors: [
      /^ResizeObserver loop/,
      /Loading chunk [\d]+ failed/,
      /Failed to fetch dynamically imported module/,
    ],
    beforeSend(event, hint) {
      const e = hint.originalException;
      if (e && typeof e === "object" && "message" in e && typeof (e as Error).message === "string") {
        const m = (e as Error).message;
        if (m.includes("access_token") || m.includes("refresh_token")) {
          return null;
        }
      }
      if (event.type === "transaction") {
        return event;
      }
      return scrubEvent(event as ErrorEvent);
    },
  });

  Sentry.setTag("build_id", getEscalaxBuildId());
}
