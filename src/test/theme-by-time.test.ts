import { describe, expect, it } from 'vitest';
import { getThemeByTime, normalizeThemePreference } from '@/lib/themeByTime';

describe('normalizeThemePreference', () => {
  it('mapeia system para auto', () => {
    expect(normalizeThemePreference('system')).toBe('auto');
  });
  it('preserva light e dark', () => {
    expect(normalizeThemePreference('light')).toBe('light');
    expect(normalizeThemePreference('dark')).toBe('dark');
  });
});

describe('getThemeByTime', () => {
  it('America/Sao_Paulo: 12h local → light', () => {
    const d = new Date('2025-06-15T15:00:00.000Z');
    expect(getThemeByTime('America/Sao_Paulo', d)).toBe('light');
  });
  it('America/Sao_Paulo: 05h local → dark', () => {
    const d = new Date('2025-06-15T08:00:00.000Z');
    expect(getThemeByTime('America/Sao_Paulo', d)).toBe('dark');
  });
  it('America/Sao_Paulo: 18h local → dark', () => {
    const d = new Date('2025-06-15T21:00:00.000Z');
    expect(getThemeByTime('America/Sao_Paulo', d)).toBe('dark');
  });
});
