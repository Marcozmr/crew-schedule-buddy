/** Escala inventada de março/2026 (base BSB) para os testes de estatísticas. Não é escala real. */
import type { ScheduleEntry } from '@/hooks/useScheduleData';

let seq = 0;

export function entry(p: Partial<ScheduleEntry>): ScheduleEntry {
  seq += 1;
  const isFlight = p.is_flight ?? true;
  return {
    id: `e${seq}`,
    roster_id: 'r1',
    date: '2026-03-01',
    flight_number: isFlight ? `LA${3000 + seq}` : (p.activity_type ?? 'DO'),
    departure: p.departure_airport ?? '',
    arrival: p.arrival_airport ?? '',
    departure_time: '',
    arrival_time: '',
    status: 'scheduled',
    airline: 'LATAM',
    report_time: null,
    duty_hours: null,
    flight_hours: null,
    activity_type: isFlight ? 'flight' : 'DO',
    is_flight: isFlight,
    pairing_code: null,
    crew_role: 'CC',
    departure_airport: null,
    arrival_airport: null,
    debrief_time: null,
    aircraft_type: null,
    hotel_name: null,
    raw_line: null,
    crosses_midnight: false,
    overnight: false,
    operation_type: isFlight ? 'OP' : null,
    assignment: null,
    comments: null,
    sort_datetime: `${p.date ?? '2026-03-01'}T${p.departure_time || '00:00'}:00`,
    entry_type: isFlight ? 'flight' : 'day_off',
    crew_status_code: null,
    crew_status_label: null,
    activity_label: null,
    ...p,
  };
}

const flight = (date: string, from: string, to: string, dep: string, arr: string, hours: number, extra: Partial<ScheduleEntry> = {}) =>
  entry({ date, departure_airport: from, arrival_airport: to, departure_time: dep, arrival_time: arr, flight_hours: hours, ...extra });

export const MARCH_PERIOD = { start: '2026-03-01', end: '2026-03-31' };

export const SAMPLE_MONTH: ScheduleEntry[] = [
  flight('2026-03-03', 'BSB', 'GRU', '08:00', '09:30', 1.5, { report_time: '05:30', duty_hours: 6, aircraft_type: '320' }),
  flight('2026-03-03', 'GRU', 'BSB', '11:00', '12:30', 1.5, { operation_type: 'PS', aircraft_type: '320' }),
  flight('2026-03-04', 'BSB', 'MAO', '21:00', '23:00', 3, { report_time: '20:00', duty_hours: 4, aircraft_type: '321' }),
  flight('2026-03-05', 'MAO', 'BSB', '01:00', '05:00', 3, { report_time: '00:00', duty_hours: 5, aircraft_type: '321' }),
  flight('2026-03-10', 'BSB', 'GRU', '10:00', '11:30', 1.5, { report_time: '09:00', duty_hours: 3.5, aircraft_type: '320' }),
  flight('2026-03-10', 'GRU', 'BSB', '13:00', '14:30', 1.5, { aircraft_type: '320' }),
  entry({ date: '2026-03-11', is_flight: false, activity_type: 'ASB', entry_type: 'reserve', duty_hours: 6 }),
  entry({ date: '2026-03-13', is_flight: false, activity_type: 'DO', entry_type: 'day_off' }),
  entry({ date: '2026-03-14', is_flight: false, activity_type: 'DO', entry_type: 'day_off' }),
  entry({ date: '2026-03-15', is_flight: false, activity_type: 'DO', entry_type: 'day_off' }),
];

/** Fevereiro com BSB↔GRU, para MAO ser "novo" em março. */
export const FEBRUARY_HISTORY: ScheduleEntry[] = [
  flight('2026-02-10', 'BSB', 'GRU', '08:00', '09:30', 1.5, { aircraft_type: '320' }),
  flight('2026-02-10', 'GRU', 'BSB', '11:00', '12:30', 1.5, { aircraft_type: '320' }),
];
