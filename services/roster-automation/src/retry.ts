export async function withRetries<T>(
  label: string,
  maxAttempts: number,
  delayMs: number,
  fn: (attempt: number) => Promise<T>,
): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (e) {
      last = e;
      if (attempt === maxAttempts) break;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw last instanceof Error ? last : new Error(`${label} failed after ${maxAttempts} attempts`);
}
