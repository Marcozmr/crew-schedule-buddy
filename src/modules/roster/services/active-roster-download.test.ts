import { describe, it, expect } from 'vitest';
import { buildScheduleEntriesCsv } from './ActiveRosterDownloadService';

describe('buildScheduleEntriesCsv', () => {
  it('inclui BOM e cabeçalhos', () => {
    const csv = buildScheduleEntriesCsv([]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('data,atividade,voo');
  });

  it('escapa vírgulas e aspas', () => {
    const csv = buildScheduleEntriesCsv([
      {
        date: '2026-03-01',
        activity_type: 'FLT,test',
        flight_number: 'LA800',
        departure_airport: 'GRU',
        arrival_airport: 'GIG',
        departure_time: '10:00',
        arrival_time: '11:00',
        is_flight: true,
      },
    ]);
    expect(csv).toContain('"FLT,test"');
  });
});
