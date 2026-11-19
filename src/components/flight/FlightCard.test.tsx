import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { FlightCard } from './FlightCard';

const leg = {
  id: 'l1', date: '2026-03-20', flight_number: 'LA9001', departure: 'REC', arrival: 'BSB', departure_airport: 'REC', arrival_airport: 'BSB',
  departure_time: '17:20', arrival_time: '20:00', is_flight: true, aircraft_type: '320', crew_role: 'CC', operation_type: 'OP',
} as ScheduleEntry;

const forecast = { iata: 'BSB', at: '2026-03-20T20:00', temp: 26.4, condition: 'Pancadas de chuva', conditionEmoji: '🌦️', windKt: 11, windDir: 120 };

function renderCard(weather?: Parameters<typeof FlightCard>[0]['weather']) {
  return render(
    <MemoryRouter>
      <FlightCard leg={leg} weather={weather} />
    </MemoryRouter>,
  );
}

describe('FlightCard — tempo do pouso', () => {
  it('mostra a previsão para a hora do pouso, com o rótulo de previsão', () => {
    renderCard({ iata: 'BSB', forecast, flightCategory: 'VFR', metarRaw: 'METAR SBBR ...' });
    expect(screen.getAllByText(/26°C/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Previsão no pouso em SBBR às 20:00/)).toBeInTheDocument();
    expect(screen.getByText(/11kt/)).toBeInTheDocument();
  });

  it('sem previsão não mostra temperatura nenhuma', () => {
    renderCard({ iata: 'BSB', forecast: null, flightCategory: 'VFR', metarRaw: 'METAR SBBR ...' });
    expect(screen.queryByText(/°C/)).toBeNull();
    expect(screen.getByText('VFR')).toBeInTheDocument();
  });
});
