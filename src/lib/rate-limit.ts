/** Simple in-memory rate limiter for client-side actions */
const attempts = new Map<string, number[]>();

/**
 * Check if an action is rate-limited.
 * @param key   Unique key for the action (e.g. 'login', 'support')
 * @param limit Max attempts allowed in the window
 * @param windowMs Time window in milliseconds
 * @returns true if the action is allowed, false if rate-limited
 */
export function checkRateLimit(key: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const record = attempts.get(key) ?? [];
  const filtered = record.filter(t => now - t < windowMs);

  if (filtered.length >= limit) {
    attempts.set(key, filtered);
    return false;
  }

  filtered.push(now);
  attempts.set(key, filtered);
  return true;
}

export function getRateLimitMessage(): string {
  return 'Muitas tentativas. Aguarde um momento antes de tentar novamente.';
}
