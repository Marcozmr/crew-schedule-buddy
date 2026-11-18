/**
 * Garante que as cores do tema (claro e escuro) mantêm texto legível: contraste ≥ 4,5:1.
 * Lê os tokens HSL direto de src/index.css.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`bloco ${selector} não encontrado`);
  const end = css.indexOf('}', start);
  const out: Record<string, string> = {};
  for (const m of css.slice(start, end).matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

function hslToRgb(value: string): [number, number, number] {
  const m = value.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!m) throw new Error(`valor HSL inválido: "${value}"`);
  const h = Number(m[1]) / 360;
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const la = luminance(hslToRgb(a));
  const lb = luminance(hslToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const PAIRS: Array<[string, string]> = [
  ['background', 'foreground'],
  ['background', 'muted-foreground'],
  ['card', 'card-foreground'],
  ['card', 'muted-foreground'],
  ['primary', 'primary-foreground'],
  ['accent', 'accent-foreground'],
  ...['voo', 'folga', 'sobreaviso', 'reserva', 'curso', 'ferias', 'dispensa'].map(
    (k) => [`day-${k}`, `day-${k}-foreground`] as [string, string],
  ),
];

describe.each([
  ['claro', ':root'],
  ['escuro', '.dark'],
])('tema %s', (_nome, selector) => {
  const tokens = block(selector);

  it.each(PAIRS)('%s × %s tem contraste ≥ 4,5', (bg, fg) => {
    expect(tokens[bg], `--${bg} ausente`).toBeDefined();
    expect(tokens[fg], `--${fg} ausente`).toBeDefined();
    expect(contrast(tokens[bg], tokens[fg])).toBeGreaterThanOrEqual(4.5);
  });
});

it('o verde principal do tema claro é #15803D', () => {
  expect(block(':root').primary).toBe('142 72% 29%');
});
