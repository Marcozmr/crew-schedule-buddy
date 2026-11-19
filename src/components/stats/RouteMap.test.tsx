import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { RouteMap } from './RouteMap';

const LEGS = [
  { from: 'BSB', to: 'GRU' },
  { from: 'GRU', to: 'AEP' },
  { from: 'BSB', to: 'MAO' },
];

function countryPathNumbers(container: HTMLElement): number[] {
  const d = container.querySelector('svg path')?.getAttribute('d') ?? '';
  return (d.match(/-?\d+(\.\d+)?(e[+-]?\d+)?/gi) ?? []).map(Number);
}

describe('RouteMap', () => {
  it('o contorno dos países fica recortado dentro do quadro (sem coordenadas gigantes)', () => {
    const { container } = render(<RouteMap legs={LEGS} />);
    const d = container.querySelector('svg path')?.getAttribute('d') ?? '';
    expect(d.length).toBeGreaterThan(0);
    expect(d).not.toMatch(/Infinity|NaN/);
    const nums = countryPathNumbers(container);
    expect(Math.max(...nums)).toBeLessThanOrEqual(341);
    expect(Math.min(...nums)).toBeGreaterThanOrEqual(-1);
  });

  it('desenha um ponto por aeroporto conhecido', () => {
    const { container } = render(<RouteMap legs={[...LEGS, { from: 'BSB', to: 'XYZ' }]} />);
    expect(container.querySelectorAll('circle')).toHaveLength(4);
  });
});
