import { describe, it, expect } from 'vitest';
import { getTodayDutyPeriods, groupIntoDutyPeriods } from '@/lib/duty-grouping';
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
    duty_hours: overrides.duty_hours ?? 1,
    flight_hours: overrides.flight_hours ?? 1,
    activity_type: overrides.activity_type ?? 'FLT',
    is_flight: overrides.is_flight ?? true,
    pairing_code: overrides.pairing_code ?? null,
    crew_role: overrides.crew_role ?? null,
    departure_airport: overrides.departure_airport ?? null,
    arrival_airport: overrides.arrival_airport ?? null,
    debrief_time: overrides.debrief_time ?? null,
    aircraft_type: overrides.aircraft_type ?? null,
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

describe('duty grouping', () => {
  it('agrupa jornada multiperna de madrugada na sequência operacional correta (APR primeiro)', () => {
    const overnightContinuation = makeFlight({
      id: 'leg-2',
      date: '2026-03-17',
      flight_number: 'LA3387',
      departure: 'JPA',
      arrival: 'GRU',
      departure_time: '03:20',
      arrival_time: '06:45',
      report_time: null,
      crosses_midnight: true,
      sort_datetime: '2026-03-17T03:20:00+00:00',
      flight_hours: 3.4,
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
      crosses_midnight: true,
      sort_datetime: '2026-03-17T23:35:00+00:00',
      flight_hours: 8.5,
    });

    const duties = groupIntoDutyPeriods([overnightContinuation, baseDeparture]);

    expect(duties).toHaveLength(1);
    expect(duties[0].routeSummary).toBe('BSB → JPA → GRU');
    expect(duties[0].legs[0].departure).toBe('BSB');
    expect(duties[0].legs[1].departure).toBe('JPA');
  });

  it('prioriza no topo a jornada que inicia na home base', () => {
    const nonBaseDuty = groupIntoDutyPeriods([
      makeFlight({
        id: 'duty-a',
        date: '2026-03-17',
        departure: 'JPA',
        arrival: 'GRU',
        departure_time: '01:00',
        arrival_time: '03:00',
      }),
    ])[0];

    const baseDuty = groupIntoDutyPeriods([
      makeFlight({
        id: 'duty-b',
        date: '2026-03-17',
        departure: 'BSB',
        arrival: 'CNF',
        report_time: '22:45',
        departure_time: '23:35',
        arrival_time: '01:15',
        crosses_midnight: true,
      }),
    ])[0];

    const ordered = getTodayDutyPeriods([nonBaseDuty, baseDuty], '2026-03-17', 'BSB');

    expect(ordered[0].legs[0].departure).toBe('BSB');
    expect(ordered[0].homeBasePriority).toBe(true);
  });
});
