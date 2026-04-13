export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export function log(
  scope: string,
  level: LogLevel,
  message: string,
  extra?: Record<string, unknown>,
): void {
  const line = {
    ts: new Date().toISOString(),
    scope,
    level,
    message,
    ...extra,
  };
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(JSON.stringify(line));
}
