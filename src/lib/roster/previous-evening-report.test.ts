import { describe, expect, it } from 'vitest';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { withPreviousEveningReports } from './previous-evening-report';

const leg = (p: Partial<ScheduleEntry>) =>
  ({ id: 'x', is_flight: true, date: '2026-03-11', report_time: '', departure_time: '08:00', ...p }) as ScheduleEntry;

describe('withPreviousEveningReports', () => {
  it('apresentação na noite anterior (23:50 para 00:13): a jornada aparece também no dia da apresentação', () => {
    const out = withPreviousEveningReports([leg({ id: 'a', report_time: '23:50', departure_time: '00:13' })]);
    expect(out.map((e) => [e.id, e.date])).toEqual([
      ['a:apresentacao', '2026-03-10'],
      ['a', '2026-03-11'],
    ]);
  });

  it('no dia da apresentação aparece "Apresentação 23:50", ordenada nesse dia e contando como dia de voo', () => {
    const [mark] = withPreviousEveningReports([leg({ id: 'a', flight_number: 'LA9001', departure: 'BEL', arrival: 'MCP', report_time: '23:50', departure_time: '00:13', arrival_time: '01:03' })]);
    expect(mark).toMatchObject({
      is_flight: false,
      entry_type: 'flight',
      activity_type: 'APR',
      crew_status_label: 'Apresentação',
      departure_time: '23:50',
      arrival_time: '',
      sort_datetime: '2026-03-10T23:50:00',
    });
  });

  it('apresentação no mesmo dia não muda nada', () => {
    const entries = [leg({ id: 'b', report_time: '05:00', departure_time: '06:00' }), leg({ id: 'c', departure_time: '09:00' })];
    expect(withPreviousEveningReports(entries)).toEqual(entries);
  });

  it('virada de mês: voo no dia 1º com apresentação no último dia do mês anterior', () => {
    const out = withPreviousEveningReports([leg({ id: 'd', date: '2026-04-01', report_time: '23:40', departure_time: '00:30' })]);
    expect(out[0]).toMatchObject({ id: 'd:apresentacao', date: '2026-03-31' });
  });
});
