import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { RouteMap } from './RouteMap';

// jsdom 20 não tem PointerEvent: sem isto, clientX chega indefinido no teste.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  (window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventPolyfill;
}

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

  it('arrastar move o mapa para ver aeroportos fora do centro', () => {
    const { container } = render(<RouteMap legs={LEGS} />);
    const svg = container.querySelector('svg')!;
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 140, clientY: 120, pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    expect(container.querySelector('svg > g')?.getAttribute('transform')?.startsWith('translate(40 20)')).toBe(true);
  });
});
