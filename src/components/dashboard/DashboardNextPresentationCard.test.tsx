import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DutyPeriod } from '@/lib/duty-grouping';
import type { ScheduleEntry } from '@/hooks/useScheduleData';

const h = vi.hoisted(() => ({ weather: {} as Record<string, unknown> }));
vi.mock('@/hooks/useLegWeather', async (orig) => ({
  ...(await orig<typeof import('@/hooks/useLegWeather')>()),
  useLegWeather: () => h.weather,
}));

import { DashboardNextPresentationCard } from './DashboardNextPresentationCard';

const legs = [
  { id: 'a', date: '2026-03-20', is_flight: true, flight_number: 'LA9002', departure: 'GRU', arrival: 'CAC', departure_airport: 'GRU', arrival_airport: 'CAC', departure_time: '15:40', arrival_time: '17:10' },
  { id: 'b', date: '2026-03-20', is_flight: true, flight_number: 'LA9003', departure: 'CAC', arrival: 'GRU', departure_airport: 'CAC', arrival_airport: 'GRU', departure_time: '17:50', arrival_time: '19:35' },
] as ScheduleEntry[];

const duty = {
  id: 'd', legs, routeSummary: 'GRU-CAC-GRU', reportTime: '14:55', dutyStartTime: '14:55', dutyEndTime: '20:05', dutyStartDate: '2026-03-20',
  dutyStartAbsoluteMin: 0, legCount: 2, totalBlockHours: 3.25, totalDutyHours: 5.2, crossesMidnight: false, hasMadrugada: false,
  connectionTimes: [], debriefTime: '20:05', homeBasePriority: false,
} as DutyPeriod;

const forecast = (iata: string, temp: number) => ({ iata, at: '2026-03-20T19:00', temp, condition: 'Nublado', conditionEmoji: '☁️', windKt: 8, windDir: 90 });

function renderCard() {
  return render(
    <MemoryRouter>
      <DashboardNextPresentationCard nextDuty={duty} todayStr="2026-03-19" />
    </MemoryRouter>,
  );
}

describe('DashboardNextPresentationCard — tempo', () => {
  it('mostra a previsão do pouso final com o rótulo de previsão', () => {
    h.weather = {
      a: { iata: 'CAC', forecast: forecast('CAC', 24.6), flightCategory: 'VFR', metarRaw: '' },
      b: { iata: 'GRU', forecast: forecast('GRU', 21.2), flightCategory: 'MVFR', metarRaw: '' },
    };
    renderCard();
    expect(screen.getAllByText(/21°C/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Previsão no pouso · GRU 19:35/)).toBeInTheDocument();
  });

  it('sem previsão não inventa 0°C', () => {
    h.weather = {
      a: { iata: 'CAC', forecast: null, flightCategory: 'UNKN', metarRaw: '' },
      b: { iata: 'GRU', forecast: null, flightCategory: 'UNKN', metarRaw: '' },
    };
    renderCard();
    expect(screen.queryByText(/°C/)).toBeNull();
  });
});
