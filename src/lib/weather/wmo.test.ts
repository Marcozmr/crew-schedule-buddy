import { describe, expect, it } from 'vitest';
import { wmoCondition } from './wmo';

describe('wmoCondition (códigos WMO do Open-Meteo)', () => {
  it.each([
    [0, 'Céu limpo'],
    [2, 'Parcialmente nublado'],
    [3, 'Nublado'],
    [45, 'Nevoeiro'],
    [51, 'Garoa'],
    [61, 'Chuva'],
    [65, 'Chuva forte'],
    [80, 'Pancadas de chuva'],
    [82, 'Pancadas de chuva fortes'],
    [95, 'Trovoada'],
    [99, 'Trovoada com granizo'],
    [-1, 'Desconhecido'],
    [123, 'Desconhecido'],
  ])('%i → %s', (code, label) => {
    expect(wmoCondition(code).label).toBe(label);
  });
});
