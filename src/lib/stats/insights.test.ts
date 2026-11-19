import { describe, expect, it } from 'vitest';
import { computeRosterStats } from './compute';
import { buildInsights } from './insights';
import { FEBRUARY_HISTORY, MARCH_PERIOD, SAMPLE_MONTH } from './__fixtures__/sample-month';

const stats = computeRosterStats({ entries: SAMPLE_MONTH, history: [...FEBRUARY_HISTORY, ...SAMPLE_MONTH], period: MARCH_PERIOD, base: 'BSB' });

describe('buildInsights', () => {
  it('pernoite no singular', () => {
    expect(buildInsights(stats)).toContain('Teve 1 pernoite programado — 1 cidade.');
  });

  it('aeroporto estreado no mês', () => {
    expect(buildInsights(stats)).toContain('Você estreou MAO este mês — já são 3 aeroportos operados.');
  });

  it('na aba Ano fala "este ano"; em Sempre não fala de estreia', () => {
    expect(buildInsights(stats, 'year')).toContain('Você estreou MAO este ano — já são 3 aeroportos operados.');
    expect(buildInsights(stats, 'all').some((s) => s.includes('estreou'))).toBe(false);
  });

  it('folgas em fim de semana e madrugadas', () => {
    const out = buildInsights(stats);
    expect(out).toContain('67% das suas folgas caíram em fim de semana. Você teve 4 fins de semana livres de 4.');
    expect(out).toContain('2 madrugadas — você se apresentou antes das 06h em 1 a cada 2 dias de voo.');
  });

  it('várias cidades: mostra o destino mais frequente', () => {
    const many = { ...stats, quality: { ...stats.quality, layovers: 3, layoversByCity: [{ city: 'São Paulo', count: 2 }, { city: 'Manaus', count: 1 }] } };
    expect(buildInsights(many)).toContain('Teve 3 pernoites programados — 2 cidades. Destino mais frequente: São Paulo (2 noites).');
  });

  it('mais de 3 aeroportos estreados vira contagem', () => {
    const many = { ...stats, airports: { ...stats.airports, newAirports: ['AEP', 'CAC', 'MCP', 'REC'], totalOperated: 18 } };
    expect(buildInsights(many)).toContain('Você estreou 4 aeroportos este mês — já são 18 aeroportos operados.');
  });

  it('no máximo 5 frases; período vazio não gera nenhuma', () => {
    expect(buildInsights(stats).length).toBeLessThanOrEqual(5);
    const empty = computeRosterStats({ entries: [], history: [], period: MARCH_PERIOD, base: 'BSB' });
    expect(buildInsights(empty)).toEqual([]);
  });
});
