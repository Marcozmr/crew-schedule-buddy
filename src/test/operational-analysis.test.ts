import { describe, it, expect } from 'vitest';
import { analyzeOperationalSchedule } from '@/lib/operational-analysis';
import type { ScheduleEntry } from '@/hooks/useScheduleData';

function makeFlight(overrides: Partial<ScheduleEntry>): ScheduleEntry {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    date: overrides.date ?? '2026-03-17',
    flight_number: overrides.flight_number ?? 'LA0000',
    departure: overrides.departure ?? 'BSB',
    arrival: overrides.arrival ?? 'GRU',
    departure_time: overrides.departure_time ?? '10:00',
    arrival_time: overrides.arrival_time ?? '11:00',
    status: overrides.status ?? 'scheduled',
    airline: overrides.airline ?? 'LATAM',
    report_time: overrides.report_time ?? null,
    duty_hours: overrides.duty_hours ?? null,
    flight_hours: overrides.flight_hours ?? null,
    activity_type: overrides.activity_type ?? 'FLT',
    is_flight: overrides.is_flight ?? true,
    pairing_code: overrides.pairing_code ?? null,
    crew_role: overrides.crew_role ?? 'CC',
    departure_airport: overrides.departure_airport ?? overrides.departure ?? 'BSB',
    arrival_airport: overrides.arrival_airport ?? overrides.arrival ?? 'GRU',
    debrief_time: overrides.debrief_time ?? null,
    aircraft_type: overrides.aircraft_type ?? 'A320',
    hotel_name: overrides.hotel_name ?? null,
    raw_line: overrides.raw_line ?? null,
    crosses_midnight: overrides.crosses_midnight ?? false,
    overnight: overrides.overnight ?? false,
    operation_type: overrides.operation_type ?? null,
    assignment: overrides.assignment ?? null,
    comments: overrides.comments ?? null,
    sort_datetime: overrides.sort_datetime ?? null,
  };
}

describe('operational analysis', () => {
  it('mantém a jornada BSB → JPA → GRU em ordem por APR e calcula pós-voo correto', () => {
    const continuation = makeFlight({
      id: 'leg-2',
      date: '2026-03-17',
      flight_number: 'LA3387',
      departure: 'JPA',
      arrival: 'GRU',
      departure_time: '03:20',
      arrival_time: '06:45',
      report_time: null,
      debrief_time: '07:15',
      crosses_midnight: true,
      sort_datetime: '2026-03-17T03:20:00+00:00',
    });

    const baseDeparture = makeFlight({
      id: 'leg-1',
      date: '2026-03-17',
      flight_number: 'LA3494',
      departure: 'BSB',
      arrival: 'JPA',
      departure_time: '23:35',
      arrival_time: '02:15',
      report_time: '22:45',
      debrief_time: '02:40',
      crosses_midnight: true,
      sort_datetime: '2026-03-17T23:35:00+00:00',
    });

    const analysis = analyzeOperationalSchedule([continuation, baseDeparture], 'America/Sao_Paulo', 'BSB');

    expect(analysis).not.toBeNull();
    expect(analysis?.window.dutyPeriods).toHaveLength(1);
    expect(analysis?.window.dutyPeriods[0].legs.map((leg) => `${leg.departureAirport}->${leg.arrivalAirport}`)).toEqual([
      'BSB->JPA',
      'JPA->GRU',
    ]);
    expect(analysis?.window.dutyPeriods[0].reportTimeUtc).toBe('2026-03-18T01:45:00.000Z');
    expect(analysis?.window.dutyPeriods[0].postFlightMinutes).toBe(30);
    expect(analysis?.latest?.duty.reportTimeLocal.slice(0, 16)).toBe('2026-03-17T22:45');
    expect(analysis?.latest?.duty.endTimeLocal.slice(0, 16)).toBe('2026-03-18T07:15');
    expect(analysis?.latest?.duty.totalDutyHours).toBe(8.5);
    expect(analysis?.latest?.duty.totalFlightHours).toBe(6.08);
  });
});
