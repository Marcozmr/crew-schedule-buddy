import { describe, it, expect } from 'vitest';
import { inferUserBaseFromEntries, normalizeAirportIata, detectUserBaseFromRoster } from '@/lib/roster/detect-user-base';
import type { ScheduleEntry } from '@/hooks/useScheduleData';

function flight(partial: Partial<ScheduleEntry> & { id: string }): ScheduleEntry {
  return {
    id: partial.id,
    date: partial.date ?? '2026-04-01',
    flight_number: partial.flight_number ?? 'LA1',
    departure: partial.departure ?? 'BSB',
    arrival: partial.arrival ?? 'GRU',
    departure_time: partial.departure_time ?? '08:00',
    arrival_time: partial.arrival_time ?? '10:00',
    status: partial.status ?? 'scheduled',
    airline: partial.airline ?? 'LA',
    report_time: partial.report_time ?? null,
    duty_hours: partial.duty_hours ?? null,
    flight_hours: partial.flight_hours ?? null,
    activity_type: partial.activity_type ?? 'FLT',
    is_flight: partial.is_flight ?? true,
    pairing_code: partial.pairing_code ?? null,
    crew_role: partial.crew_role ?? null,
    departure_airport: partial.departure_airport ?? null,
    arrival_airport: partial.arrival_airport ?? null,
    debrief_time: partial.debrief_time ?? null,
    aircraft_type: partial.aircraft_type ?? null,
    hotel_name: partial.hotel_name ?? null,
    raw_line: partial.raw_line ?? null,
    crosses_midnight: partial.crosses_midnight ?? false,
    overnight: partial.overnight ?? false,
    operation_type: partial.operation_type ?? null,
    assignment: partial.assignment ?? null,
    comments: partial.comments ?? null,
    sort_datetime: partial.sort_datetime ?? null,
    entry_type: partial.entry_type ?? null,
    crew_status_code: partial.crew_status_code ?? null,
    crew_status_label: partial.crew_status_label ?? null,
    activity_label: partial.activity_label ?? null,
  };
}

describe('detect-user-base', () => {
  it('normaliza IATA', () => {
    expect(normalizeAirportIata('bsb')).toBe('BSB');
    expect(normalizeAirportIata('Trecho BSB → GRU')).toBe('BSB');
  });

  it('infere base dominante nas partidas', () => {
    const entries = [
      flight({ id: '1', departure: 'BSB', arrival: 'GRU' }),
      flight({ id: '2', departure: 'BSB', arrival: 'CNF' }),
      flight({ id: '3', departure: 'BSB', arrival: 'GIG' }),
    ];
    const r = inferUserBaseFromEntries(entries);
    expect(r.base).toBe('BSB');
    expect(r.confidence).toBe('high');
  });

  it('usa cabeçalho explícito', () => {
    const r = detectUserBaseFromRoster({
      explicitHeaderBase: 'CNF',
      entries: [flight({ id: '1', departure: 'BSB', arrival: 'GRU' })],
      importSource: 'pdf',
    });
    expect(r.base).toBe('CNF');
    expect(r.confidence).toBe('high');
  });
});
