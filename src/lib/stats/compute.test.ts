import { describe, expect, it } from 'vitest';
import { getAirport } from '@/lib/airports';
import { computeRosterStats } from './compute';
import { entry, FEBRUARY_HISTORY, MARCH_PERIOD, SAMPLE_MONTH } from './__fixtures__/sample-month';

function haversineKm(a: string, b: string): number {
  const p = getAirport(a)!;
  const q = getAirport(b)!;
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(q.lat - p.lat) / 2) ** 2 + Math.cos(rad(p.lat)) * Math.cos(rad(q.lat)) * Math.sin(rad(q.lon - p.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const stats = computeRosterStats({ entries: SAMPLE_MONTH, history: [...FEBRUARY_HISTORY, ...SAMPLE_MONTH], period: MARCH_PERIOD, base: 'BSB' });

describe('computeRosterStats — resumo', () => {
  it('horas, folgas e eficiência', () => {
    expect(stats.summary.flownMinutes).toBe(630);
    expect(stats.summary.dutyMinutes).toBe(1470);
    expect(stats.summary.daysOff).toBe(3);
    expect(stats.summary.efficiency).toBeCloseTo(630 / 1470, 5);
  });
  it('madrugadas e pousos tarde', () => {
    expect(stats.summary.earlyReports).toBe(2);
    // BSB→MAO pousa 23:00 e MAO→BSB pousa 05:00: os dois na janela 23h–06h.
    expect(stats.summary.lateLandings).toBe(2);
  });
  it('pouso depois da meia-noite conta como pouso tarde', () => {
    const s = computeRosterStats({
      entries: [entry({ date: '2026-03-03', departure_airport: 'GRU', arrival_airport: 'REC', departure_time: '21:30', arrival_time: '00:30', crosses_midnight: true, flight_hours: 3 })],
      history: [],
      period: MARCH_PERIOD,
      base: 'BSB',
    });
    expect(s.summary.lateLandings).toBe(1);
  });
});

describe('computeRosterStats — qualidade de vida', () => {
  it('noites e pernoites', () => {
    expect(stats.quality.nightsHome).toBe(30);
    expect(stats.quality.nightsAway).toBe(1);
    expect(stats.quality.layovers).toBe(1);
    expect(stats.quality.layoversByCity).toEqual([{ city: 'Manaus', count: 1 }]);
  });
  it('fins de semana, blocos de folga e de trabalho', () => {
    expect(stats.quality.weekendsFree).toBe(4);
    expect(stats.quality.weekendsTotal).toBe(4);
    expect(stats.quality.daysOffOnWeekend).toBe(2);
    expect(stats.quality.longestOffBlock).toBe(3);
    expect(stats.quality.longestWorkStreak).toBe(3);
    expect(stats.quality.baseInferred).toBe(false);
  });
  it('sem base configurada, usa a estação de onde mais sai o primeiro voo do dia', () => {
    const s = computeRosterStats({ entries: SAMPLE_MONTH, history: SAMPLE_MONTH, period: MARCH_PERIOD, base: null });
    expect(s.quality.base).toBe('BSB');
    expect(s.quality.baseInferred).toBe(true);
  });
});

describe('computeRosterStats — voos', () => {
  it('pernas, deadheads e distância', () => {
    expect(stats.flights.legs).toBe(5);
    expect(stats.flights.deadheads).toBe(1);
    expect(stats.flights.deadheadMinutes).toBe(90);
    const expected = 4 * haversineKm('BSB', 'GRU') + 2 * haversineKm('BSB', 'MAO');
    expect(Math.abs(stats.flights.distanceKm - expected) / expected).toBeLessThan(0.01);
    expect(stats.flights.earthLaps).toBeCloseTo(stats.flights.distanceKm / 40075, 5);
  });
  it('rota mais voada e dia com mais pernas (empates: ordem alfabética e data mais cedo)', () => {
    expect(stats.flights.topRoute).toEqual({ from: 'BSB', to: 'GRU', count: 2 });
    expect(stats.flights.busiestDay).toEqual({ date: '2026-03-03', legs: 2 });
  });
  it('horas diurnas e noturnas no fuso da base', () => {
    expect(stats.flights.dayMinutes).toBe(270);
    expect(stats.flights.nightMinutes).toBe(360);
    expect(stats.flights.dayMinutes + stats.flights.nightMinutes).toBe(630);
  });
  it('ritmo', () => {
    expect(stats.flights.flightDays).toBe(4);
    expect(stats.flights.legsPerDay).toBe(1.25);
    expect(stats.flights.avgLegMinutes).toBe(126);
    expect(stats.flights.longestLeg).toEqual({ from: 'BSB', to: 'MAO', minutes: 180 });
    expect(stats.flights.shortestLeg).toEqual({ from: 'BSB', to: 'GRU', minutes: 90 });
  });
});

describe('computeRosterStats — aeroportos e aeronaves', () => {
  it('aeroportos, novos e rotas', () => {
    expect(stats.airports.distinct).toBe(3);
    expect(stats.airports.newAirports).toEqual(['MAO']);
    expect(stats.airports.totalOperated).toBe(3);
    expect(stats.airports.byCount).toEqual([
      { iata: 'BSB', count: 6 },
      { iata: 'GRU', count: 4 },
      { iata: 'MAO', count: 2 },
    ]);
    expect(stats.airports.routes[0]).toEqual({ from: 'BSB', to: 'GRU', count: 2 });
    expect(stats.airports.mapLegs).toHaveLength(4);
  });
  it('tipo dominante', () => {
    expect(stats.aircraft.dominantType?.type).toBe('320');
    expect(stats.aircraft.dominantType?.share).toBeCloseTo(4 / 6, 5);
    expect(stats.aircraft.byType).toEqual([
      { type: '320', count: 4 },
      { type: '321', count: 2 },
    ]);
  });
});

describe('computeRosterStats — ajustes conferidos com a escala real', () => {
  it('DOF (folga fixa anual) conta como folga mesmo gravado como outra atividade', () => {
    const s = computeRosterStats({
      entries: [entry({ date: '2026-03-01', is_flight: false, activity_type: 'DOF', entry_type: 'other_activity' })],
      history: [],
      period: MARCH_PERIOD,
      base: 'BSB',
    });
    expect(s.summary.daysOff).toBe(1);
    expect(s.quality.daysOffOnWeekend).toBe(1);
  });

  it('apresentação na noite anterior ao primeiro voo conta aquele dia como trabalho', () => {
    const s = computeRosterStats({
      entries: [
        entry({ date: '2026-03-09', departure_airport: 'BSB', arrival_airport: 'BEL', departure_time: '20:40', arrival_time: '23:16', flight_hours: 2.6 }),
        entry({ date: '2026-03-11', departure_airport: 'BEL', arrival_airport: 'MCP', departure_time: '00:13', arrival_time: '01:03', report_time: '23:50', flight_hours: 0.83 }),
      ],
      history: [],
      period: MARCH_PERIOD,
      base: 'BSB',
    });
    expect(s.quality.longestWorkStreak).toBe(3);
  });

  it('pouso de madrugada (até 06h) também é pouso depois das 23h', () => {
    const s = computeRosterStats({
      entries: [entry({ date: '2026-03-11', departure_airport: 'MCP', arrival_airport: 'BEL', departure_time: '02:26', arrival_time: '03:20', flight_hours: 0.9 })],
      history: [],
      period: MARCH_PERIOD,
      base: 'BSB',
    });
    expect(s.summary.lateLandings).toBe(1);
  });

  it('sem histórico anterior, nenhum aeroporto é "novo"', () => {
    const s = computeRosterStats({ entries: SAMPLE_MONTH, history: SAMPLE_MONTH, period: MARCH_PERIOD, base: 'BSB' });
    expect(s.airports.newAirports).toEqual([]);
  });
});

describe('computeRosterStats — casos de borda', () => {
  it('mês vazio: zeros, sem divisão por zero', () => {
    const s = computeRosterStats({ entries: [], history: [], period: MARCH_PERIOD, base: 'BSB' });
    expect(s.summary.flownMinutes).toBe(0);
    expect(s.summary.efficiency).toBeNull();
    expect(s.flights.topRoute).toBeNull();
    expect(s.flights.busiestDay).toBeNull();
    expect(s.flights.longestLeg).toBeNull();
    expect(s.flights.legsPerDay).toBe(0);
    expect(s.flights.avgLegMinutes).toBe(0);
    expect(s.aircraft.dominantType).toBeNull();
    expect(s.quality.nightsHome).toBe(0); // sem escala no mês, não há noites para contar
  });
  it('aeroporto desconhecido conta como perna e fica fora da distância e do mapa', () => {
    const s = computeRosterStats({
      entries: [entry({ date: '2026-03-03', departure_airport: 'BSB', arrival_airport: 'XYZ', departure_time: '10:00', arrival_time: '11:00', flight_hours: 1 })],
      history: [],
      period: MARCH_PERIOD,
      base: 'BSB',
    });
    expect(s.flights.legs).toBe(1);
    expect(s.flights.distanceKm).toBe(0);
    expect(s.airports.mapLegs).toEqual([]);
  });
});

describe('computeRosterStats — achados da revisão', () => {
  it('Ano com um só mês importado: noites e fins de semana só dos meses com escala', () => {
    const s = computeRosterStats({ entries: SAMPLE_MONTH, history: SAMPLE_MONTH, period: { start: '2026-01-01', end: '2026-12-31' }, base: 'BSB' });
    expect(s.quality.nightsHome + s.quality.nightsAway).toBe(31);
    expect(s.quality.weekendsTotal).toBe(4);
  });
  it('base digitada como cidade ou ICAO é ignorada e a base é inferida', () => {
    for (const base of ['Brasília', 'SBBR']) {
      const s = computeRosterStats({ entries: SAMPLE_MONTH, history: SAMPLE_MONTH, period: MARCH_PERIOD, base });
      expect(s.quality.base).toBe('BSB');
      expect(s.quality.baseInferred).toBe(true);
      expect(s.quality.nightsAway).toBe(1);
    }
  });
});
