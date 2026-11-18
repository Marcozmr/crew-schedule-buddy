import { describe, expect, it } from 'vitest';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { DAY_KIND_META, dayKindForEntries } from './day-kind';

function entry(partial: Partial<ScheduleEntry>): ScheduleEntry {
  return {
    id: Math.random().toString(36).slice(2),
    date: '2026-11-18',
    flight_number: '',
    departure: '',
    arrival: '',
    departure_time: '',
    arrival_time: '',
    status: '',
    airline: null,
    report_time: null,
    duty_hours: null,
    flight_hours: null,
    activity_type: '',
    is_flight: false,
    pairing_code: null,
    crew_role: null,
    departure_airport: null,
    arrival_airport: null,
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
    ...partial,
  };
}

describe('dayKindForEntries', () => {
  it.each([
    ['day_off', 'folga'],
    ['vacation', 'ferias'],
    ['reserve', 'reserva'],
    ['standby', 'sobreaviso'],
    ['training', 'curso'],
    ['sick', 'dispensa'],
  ])('entry_type %s → %s', (entryType, kind) => {
    expect(dayKindForEntries([entry({ entry_type: entryType })])).toBe(kind);
  });

  it('voo → voo', () => {
    expect(dayKindForEntries([entry({ is_flight: true, flight_number: 'LA3748' })])).toBe('voo');
  });

  it('dia sem lançamento → vazio (não folga)', () => {
    expect(dayKindForEntries([])).toBe('vazio');
  });

  it('voo e sobreaviso no mesmo dia → voo', () => {
    expect(dayKindForEntries([entry({ entry_type: 'standby' }), entry({ is_flight: true })])).toBe('voo');
  });

  it('entry_type nulo com código HSB → sobreaviso', () => {
    expect(dayKindForEntries([entry({ entry_type: null, crew_status_code: 'HSB' })])).toBe('sobreaviso');
  });

  it('código desconhecido → outro', () => {
    expect(dayKindForEntries([entry({ entry_type: 'admin' })])).toBe('outro');
  });
});

describe('DAY_KIND_META', () => {
  it('siglas da spec', () => {
    expect(DAY_KIND_META.voo.sigla).toBe('VOO');
    expect(DAY_KIND_META.folga.sigla).toBe('FOL');
    expect(DAY_KIND_META.sobreaviso.sigla).toBe('SOB');
    expect(DAY_KIND_META.reserva.sigla).toBe('RES');
    expect(DAY_KIND_META.curso.sigla).toBe('CUR');
    expect(DAY_KIND_META.ferias.sigla).toBe('FÉR');
    expect(DAY_KIND_META.dispensa.sigla).toBe('MED');
    expect(DAY_KIND_META.vazio.sigla).toBe('');
  });

  it('cada tipo usa a cor dele', () => {
    expect(DAY_KIND_META.reserva.className).toContain('bg-day-reserva');
    expect(DAY_KIND_META.reserva.className).toContain('text-day-reserva-foreground');
  });
});
