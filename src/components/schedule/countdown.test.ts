import { describe, expect, it } from 'vitest';
import { formatCountdown } from './countdown';

const MIN = 60_000;

describe('formatCountdown', () => {
  it('já começou → agora', () => expect(formatCountdown(-5 * MIN)).toBe('agora'));
  it('menos de 1 h → minutos', () => expect(formatCountdown(45 * MIN)).toBe('em 45 min'));
  it('horas com minutos em 2 dígitos', () => expect(formatCountdown((3 * 60 + 3) * MIN)).toBe('em 3h03'));
  it('48 h ou mais → dias', () => expect(formatCountdown(72 * 60 * MIN)).toBe('em 3 dias'));
});
