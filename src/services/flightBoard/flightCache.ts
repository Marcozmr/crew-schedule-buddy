/**
 * Cache em memória para reduzir requests às APIs de voo
 * TTL: 5 minutos
 */

const TTL_MS = 5 * 60 * 1000; // 5 minutos

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function makeKey(prefix: string, ...parts: string[]): string {
  return `${prefix}:${parts.join(":")}`;
}

export function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setInCache<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + TTL_MS,
  });
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export const cacheKeys = {
  flights: (airport: string, date: string, mode: string) =>
    makeKey("flights", airport, date, mode),
  flightStatus: (flightNumber: string, date: string) =>
    makeKey("status", flightNumber, date),
  nearby: (bbox: string) => makeKey("nearby", bbox),
};
