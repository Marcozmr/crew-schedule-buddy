import { resolveSafeIANATimezone } from '@/lib/date-utils';

export type ThemePreference = 'auto' | 'light' | 'dark';

/** Migra valores antigos (`system`) e inválidos para o modelo atual. */
export function normalizeThemePreference(raw: string | null | undefined): ThemePreference {
  const t = (raw ?? '').trim().toLowerCase();
  if (t === 'system' || t === 'auto' || t === '') return 'auto';
  if (t === 'light' || t === 'dark') return t;
  return 'auto';
}

/**
 * Tema visual conforme horário local no fuso informado.
 * 06:00–17:59 → light; 18:00–05:59 → dark.
 *
 * @param timezone IANA (ex.: America/Sao_Paulo). Se vazio, usa o fuso do navegador.
 */
export function getThemeByTime(timezone?: string | null, now: Date = new Date()): 'light' | 'dark' {
  const tz =
    timezone != null && String(timezone).trim() !== ''
      ? resolveSafeIANATimezone(timezone)
      : Intl.DateTimeFormat().resolvedOptions().timeZone;

  try {
    const hourStr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    })
      .formatToParts(now)
      .find((p) => p.type === 'hour')?.value;
    const hour = Number(hourStr);
    if (Number.isNaN(hour)) return fallbackByBrowserLocalHour(now);
    if (hour >= 6 && hour <= 17) return 'light';
    return 'dark';
  } catch {
    return fallbackByBrowserLocalHour(now);
  }
}

function fallbackByBrowserLocalHour(now: Date): 'light' | 'dark' {
  const hour = now.getHours();
  if (hour >= 6 && hour <= 17) return 'light';
  return 'dark';
}

export function applyResolvedThemePreference(
  pref: ThemePreference,
  timezone: string | null | undefined,
  setTheme: (t: string) => void,
): void {
  if (pref === 'auto') {
    setTheme(getThemeByTime(timezone));
  } else {
    setTheme(pref);
  }
}
