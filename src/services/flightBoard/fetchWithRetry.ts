/**
 * Fetch com retry e timeout para chamadas às APIs
 */

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
}

export async function fetchWithRetry(
  url: string,
  opts: RequestInit = {},
  options: FetchOptions = {}
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? DEFAULT_RETRIES;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, {
        ...opts,
        signal: controller.signal,
      });
      clearTimeout(id);
      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  throw lastError ?? new Error("Requisição falhou após tentativas");
}
