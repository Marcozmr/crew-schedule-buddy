import { describe, expect, it } from 'vitest';
import {
  buildCrewAbbrevPairFromLeg,
  resolveRosterRoleSigla,
  resolveRosterSituationSigla,
} from '@/lib/roster/crew-display-abbrev';
import type { ScheduleEntry } from '@/hooks/useScheduleData';

function baseEntry(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    id: '1',
    date: '2025-03-24',
    flight_number: 'LA1234',
    departure: 'GRU',
    arrival: 'SSA',
    departure_time: '10:00',
    arrival_time: '12:00',
    status: 'scheduled',
    airline: 'LA',
    report_time: null,
    duty_hours: null,
    flight_hours: 2,
    activity_type: 'flight',
    is_flight: true,
    pairing_code: null,
    crew_role: null,
    departure_airport: 'GRU',
    arrival_airport: 'SSA',
    debrief_time: null,
    aircraft_type: null,
    hotel_name: null,
    raw_line: null,
    crosses_midnight: false,
    overnight: false,
    operation_type: null,
    assignment: null,
    comments: null,
    sort_datetime: null,
    entry_type: null,
    crew_status_code: null,
    crew_status_label: null,
    activity_label: null,
    ...overrides,
  };
}

describe('resolveRosterSituationSigla', () => {
  it('usa crew_status_code quando existir (ex.: OP no PDF)', () => {
    const leg = baseEntry({
      crew_status_code: 'OP',
      crew_status_label: 'Tripulando',
      operation_type: 'OP',
    });
    expect(resolveRosterSituationSigla(leg)).toBe('OP');
  });

  it('usa operation_type OP/PS quando não houver código (fiel ao roster)', () => {
    expect(
      resolveRosterSituationSigla(
        baseEntry({ crew_status_code: null, operation_type: 'OP', crew_status_label: 'Tripulando' }),
      ),
    ).toBe('OP');
    expect(
      resolveRosterSituationSigla(
        baseEntry({ crew_status_code: null, operation_type: 'PS', crew_status_label: 'Reposicionamento' }),
      ),
    ).toBe('PS');
  });

  it('não trata "Tripulando" como sigla — cai no fallback mecânico se não houver OP/PS no dado', () => {
    expect(
      resolveRosterSituationSigla(
        baseEntry({
          crew_status_code: null,
          operation_type: null,
          crew_status_label: 'Tripulando',
        }),
      ),
    ).toBe('TRIPUL');
  });
});

describe('resolveRosterRoleSigla', () => {
  it('preserva função exata (ex.: CC)', () => {
    const leg = baseEntry({ crew_role: 'CC' });
    expect(resolveRosterRoleSigla(leg)).toBe('CC');
  });
});

describe('buildCrewAbbrevPairFromLeg', () => {
  it('caso real: OP + CC sem conversão genérica', () => {
    const pair = buildCrewAbbrevPairFromLeg(
      baseEntry({
        crew_status_code: 'OP',
        crew_status_label: 'Tripulando',
        operation_type: 'OP',
        crew_role: 'CC',
      }),
    );
    expect(pair.situation).toBe('OP');
    expect(pair.role).toBe('CC');
  });

  it('PS + PUR preservados', () => {
    const pair = buildCrewAbbrevPairFromLeg(
      baseEntry({
        crew_status_code: 'PS',
        operation_type: 'PS',
        crew_role: 'PUR',
      }),
    );
    expect(pair.situation).toBe('PS');
    expect(pair.role).toBe('PUR');
  });
});
