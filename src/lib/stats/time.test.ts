import { describe, expect, it } from 'vitest';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { legUtcRange, localToUtcMs, splitDayNightMinutes } from './time';

function leg(p: Partial<ScheduleEntry>): ScheduleEntry {
  return {
    id: 'x', date: '2026-03-17', flight_number: 'LA1', departure: '', arrival: '', departure_time: '', arrival_time: '',
    status: 'scheduled', airline: 'LATAM', report_time: null, duty_hours: null, flight_hours: null, activity_type: 'flight',
    is_flight: true, pairing_code: null, crew_role: null, departure_airport: null, arrival_airport: null, debrief_time: null,
    aircraft_type: null, hotel_name: null, raw_line: null, crosses_midnight: false, overnight: false, operation_type: 'OP',
    assignment: null, comments: null, sort_datetime: null, entry_type: 'flight', crew_status_code: null, crew_status_label: null,
    activity_label: null, ...p,
  };
}

describe('localToUtcMs', () => {
  it('Recife (UTC-3)', () => {
    expect(localToUtcMs('2026-03-20', '17:20', 'America/Recife')).toBe(Date.UTC(2026, 2, 20, 20, 20));
  });
  it('Manaus (UTC-4)', () => {
    expect(localToUtcMs('2026-03-17', '12:28', 'America/Manaus')).toBe(Date.UTC(2026, 2, 17, 16, 28));
  });
});

describe('legUtcRange', () => {
  it('BSB 10:27 → MAO 12:28 dura 3h01 (fusos diferentes)', () => {
    const r = legUtcRange(leg({ departure_airport: 'BSB', arrival_airport: 'MAO', departure_time: '10:27', arrival_time: '12:28' }))!;
    expect((r.end - r.start) / 60000).toBe(181);
  });
  it('pouso no dia seguinte (crosses_midnight) soma um dia', () => {
    const r = legUtcRange(
      leg({ date: '2026-03-19', departure_airport: 'GRU', arrival_airport: 'REC', departure_time: '21:10', arrival_time: '00:15', crosses_midnight: true }),
    )!;
    expect((r.end - r.start) / 60000).toBe(185);
  });
  it('aeroporto desconhecido devolve null', () => {
    expect(legUtcRange(leg({ departure_airport: 'XYZ', arrival_airport: 'BSB', departure_time: '10:00', arrival_time: '11:00' }))).toBeNull();
  });
});

describe('splitDayNightMinutes (06h–18h diurno, no fuso dado)', () => {
  const sp = 'America/Sao_Paulo';
  it('17:00 → 19:00 = 60 diurnos + 60 noturnos', () => {
    expect(splitDayNightMinutes(localToUtcMs('2026-03-10', '17:00', sp), localToUtcMs('2026-03-10', '19:00', sp), sp)).toEqual({ day: 60, night: 60 });
  });
  it('23:00 → 01:00 = tudo noturno', () => {
    expect(splitDayNightMinutes(localToUtcMs('2026-03-10', '23:00', sp), localToUtcMs('2026-03-11', '01:00', sp), sp)).toEqual({ day: 0, night: 120 });
  });
  it('05:00 → 07:00 = 60 noturnos + 60 diurnos', () => {
    expect(splitDayNightMinutes(localToUtcMs('2026-03-10', '05:00', sp), localToUtcMs('2026-03-10', '07:00', sp), sp)).toEqual({ day: 60, night: 60 });
  });
});
