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
    entry_type: overrides.entry_type ?? null,
    crew_status_code: overrides.crew_status_code ?? null,
    crew_status_label: overrides.crew_status_label ?? null,
    activity_label: overrides.activity_label ?? null,
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

  it('coloca Apresentação (APR) antes do voo na mesma jornada quando o horário for anterior', () => {
    const apr = makeFlight({
      id: 'apr-1',
      date: '2026-03-20',
      flight_number: 'APR',
      departure: 'CGH',
      arrival: 'CGH',
      departure_time: '22:43',
      arrival_time: '23:30',
      is_flight: false,
      activity_type: 'APR',
      entry_type: 'duty_start',
      crew_status_code: 'APR',
      report_time: '22:43',
      sort_datetime: '2026-03-20T22:43:00',
      flight_hours: null,
      duty_hours: null,
    });
    const voo = makeFlight({
      id: 'voo-1',
      date: '2026-03-20',
      flight_number: 'LA3590',
      departure: 'CGH',
      arrival: 'BSB',
      departure_time: '23:30',
      arrival_time: '01:05',
      report_time: '22:50',
      crosses_midnight: true,
      sort_datetime: '2026-03-20T23:30:00',
    });
    const duties = groupIntoDutyPeriods([voo, apr]);
    expect(duties).toHaveLength(1);
    expect(duties[0].legs[0].flight_number).toBe('APR');
    expect(duties[0].legs[1].flight_number).toBe('LA3590');
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

  it('jornada multiperna não fica 0min quando a chegada final é madrugada no mesmo date do roster (GRU→…→GRU)', () => {
    const apr = makeFlight({
      id: 'apr',
      date: '2026-03-20',
      flight_number: 'APR',
      departure: 'GRU',
      arrival: 'GRU',
      departure_time: '22:43',
      arrival_time: '23:00',
      is_flight: false,
      activity_type: 'APR',
      report_time: '22:43',
      duty_hours: null,
      flight_hours: null,
    });
    const leg1 = makeFlight({
      id: 'l1',
      date: '2026-03-20',
      flight_number: 'LA1',
      departure: 'GRU',
      arrival: 'SSA',
      departure_time: '23:50',
      arrival_time: '02:10',
      report_time: null,
      crosses_midnight: true,
      flight_hours: 2.3,
    });
    const leg2 = makeFlight({
      id: 'l2',
      date: '2026-03-20',
      flight_number: 'LA2',
      departure: 'SSA',
      arrival: 'GRU',
      departure_time: '03:40',
      arrival_time: '05:25',
      report_time: null,
      crosses_midnight: true,
      flight_hours: 2.9,
    });

    const duties = groupIntoDutyPeriods([leg2, leg1, apr]);
    expect(duties).toHaveLength(1);
    expect(duties[0].totalDutyHours).toBeGreaterThan(0);
    expect(duties[0].totalDutyHours).toBeGreaterThan(5);
  });

  it('não junta duas jornadas com pernoite real só porque o parser repetiu a mesma `date` (conexão de 5min seria implausível)', () => {
    // Cenário real reportado: GRU→BEL (chega 00:15) e, no dia seguinte de verdade (com
    // pernoite em BEL), BEL→MCP (sai 00:20). Se o roster atribuiu a mesma `date` às duas
    // pernas, a virada de meia-noite ingênua computaria só 5min de conexão — impossível — e
    // juntaria as duas jornadas erradamente numa só ("uma programação só").
    const leg1 = makeFlight({
      id: 'gru-bel',
      date: '2026-09-05',
      flight_number: 'LA3232',
      departure: 'GRU',
      arrival: 'BEL',
      departure_time: '20:35',
      arrival_time: '00:15',
      report_time: '19:48',
      crosses_midnight: true,
      flight_hours: 3.67,
    });
    const leg2 = makeFlight({
      id: 'bel-mcp',
      date: '2026-09-05', // bug do parser: deveria ser o dia seguinte (há pernoite real)
      flight_number: 'LA3571',
      departure: 'BEL',
      arrival: 'MCP',
      departure_time: '00:20',
      arrival_time: '01:15',
      report_time: null,
      flight_hours: 0.92,
    });

    const duties = groupIntoDutyPeriods([leg1, leg2]);
    expect(duties).toHaveLength(2);
  });
});
