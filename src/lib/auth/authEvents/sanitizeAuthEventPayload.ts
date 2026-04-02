/**
 * Remove chaves e valores que possam conter segredos, tokens ou dados de callback crus.
 */

const SENSITIVE_KEY = /password|token|secret|authorization|bearer|refresh|access.?token|hash|query|fragment|code_verifier|id_token|provider_token/i;

const MAX_STRING = 200;
const MAX_DEPTH = 5;
const MAX_KEYS = 32;

function truncateString(s: string): string {
  const t = s.trim();
  if (t.length <= MAX_STRING) return t;
  return `${t.slice(0, MAX_STRING)}…`;
}

/**
 * Sanitiza metadata para logs e persistência (sem senhas, tokens, hash/query crus).
 */
export function sanitizeAuthEventPayload(
  input: Record<string, unknown> | undefined | null,
  depth = 0,
): Record<string, string | number | boolean | null> {
  if (!input || depth > MAX_DEPTH) return {};

  const out: Record<string, string | number | boolean | null> = {};
  let count = 0;

  for (const [rawKey, rawVal] of Object.entries(input)) {
    if (count >= MAX_KEYS) break;
    const key = rawKey.trim();
    if (!key || SENSITIVE_KEY.test(key)) continue;

    if (rawVal === null || rawVal === undefined) {
      out[key] = null;
      count++;
      continue;
    }

    if (typeof rawVal === "boolean" || typeof rawVal === "number") {
      if (Number.isFinite(rawVal as number) || typeof rawVal === "boolean") {
        out[key] = rawVal as number | boolean;
        count++;
      }
      continue;
    }

    if (typeof rawVal === "string") {
      if (SENSITIVE_KEY.test(rawVal)) {
        out[key] = "[redacted]";
      } else {
        out[key] = truncateString(rawVal);
      }
      count++;
      continue;
    }

    if (typeof rawVal === "object" && !Array.isArray(rawVal)) {
      const nested = sanitizeAuthEventPayload(rawVal as Record<string, unknown>, depth + 1);
      if (Object.keys(nested).length > 0) {
        out[key] = JSON.stringify(nested);
        count++;
      }
      continue;
    }

    if (Array.isArray(rawVal)) {
      const safe = rawVal.slice(0, 10).map((v) =>
        typeof v === "string" ? (SENSITIVE_KEY.test(v) ? "[redacted]" : truncateString(v)) : String(v),
      );
      out[key] = JSON.stringify(safe);
      count++;
    }
  }

  return out;
}
