import { describe, expect, it } from 'vitest';
import { AIRPORTS_DB, airportTz, getAirport } from './airports';

describe('tabela de aeroportos', () => {
  it.each([
    ['BSB', 'America/Sao_Paulo'],
    ['GRU', 'America/Sao_Paulo'],
    ['MAO', 'America/Manaus'],
    ['CGB', 'America/Cuiaba'],
    ['BEL', 'America/Belem'],
    ['MCP', 'America/Belem'],
    ['REC', 'America/Recife'],
    ['SSA', 'America/Bahia'],
    ['FOR', 'America/Fortaleza'],
    ['AEP', 'America/Argentina/Buenos_Aires'],
  ])('%s está no fuso %s', (iata, tz) => {
    expect(airportTz(iata)).toBe(tz);
  });

  it('conhece aeroportos da rede que não estavam na tabela antiga', () => {
    for (const iata of ['CAC', 'MCP', 'AEP', 'GYN', 'CNF', 'VIX', 'FLN', 'SCL', 'LIM']) {
      expect(getAirport(iata), iata).toBeDefined();
    }
  });

  it('aceita minúsculas e espaços', () => {
    expect(getAirport(' bsb ')?.icao).toBe('SBBR');
  });

  it('IATA desconhecido devolve undefined', () => {
    expect(getAirport('XXX')).toBeUndefined();
    expect(airportTz('XXX')).toBeUndefined();
  });

  it('coordenadas de Brasília estão certas', () => {
    const bsb = getAirport('BSB')!;
    expect(bsb.lat).toBeGreaterThan(-16);
    expect(bsb.lat).toBeLessThan(-15.7);
    expect(bsb.lon).toBeGreaterThan(-48.1);
    expect(bsb.lon).toBeLessThan(-47.8);
  });

  it('mantém o nome de cidade em português das entradas antigas', () => {
    expect(getAirport('CGH')?.city).toBe('São Paulo');
    expect(getAirport('BSB')?.city).toBe('Brasília');
  });

  it('cobre pelo menos 150 aeroportos', () => {
    expect(Object.keys(AIRPORTS_DB).length).toBeGreaterThanOrEqual(150);
  });
});
