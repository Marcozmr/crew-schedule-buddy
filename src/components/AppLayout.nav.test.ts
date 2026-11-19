import { describe, expect, it } from 'vitest';
import { bottomNavItems } from './navigation-items';

describe('barra de baixo', () => {
  it('tem Estatísticas e Salário no lugar de MetCenter e Stats', () => {
    const labels = bottomNavItems.map((i) => `${i.label}:${i.path}`);
    expect(labels).toContain('Estatísticas:/estatisticas');
    expect(labels).toContain('Salário:/salary');
    expect(labels.some((l) => l.startsWith('MetCenter'))).toBe(false);
    expect(labels.some((l) => l.startsWith('Stats'))).toBe(false);
  });
});
