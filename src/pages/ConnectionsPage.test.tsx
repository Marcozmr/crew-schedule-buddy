import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({
  crewmates: [] as unknown[],
  connections: [] as unknown[],
  conversations: [] as unknown[],
  daysOff: vi.fn(),
  layovers: vi.fn(),
}));

vi.mock('@/components/AppLayout', () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/lib/services/crew-discovery-service', () => ({
  CrewDiscoveryService: {
    getRosterCrewmates: async () => h.crewmates,
    listConnections: async () => h.connections,
    getSharedDaysOff: h.daysOff,
    getSharedLayovers: h.layovers,
  },
}));
vi.mock('@/lib/services/crew-conversation-service', () => ({
  CrewConversationService: { listConversations: async () => h.conversations },
}));

import ConnectionsPage from './ConnectionsPage';

const renderPage = () =>
  render(
    <MemoryRouter>
      <ConnectionsPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  h.crewmates = [];
  h.connections = [];
  h.conversations = [];
  h.daysOff.mockReset().mockResolvedValue([]);
  h.layovers.mockReset().mockResolvedValue([]);
});

describe('ConnectionsPage', () => {
  it('agrupa os próximos voos e mostra quem do EscalaX está em cada um', async () => {
    const base = { flightDate: '2099-03-20', flightNumber: 'LA9001', departure: 'BSB', arrival: 'GRU', partnerAirline: 'LATAM' };
    h.crewmates = [
      { ...base, partnerUserId: 'p1', partnerName: 'Ana Souza', crewRole: 'CC' },
      { ...base, partnerUserId: 'p2', partnerName: 'Bruno Lima', crewRole: 'CM' },
    ];
    renderPage();
    expect(await screen.findByText('LA9001')).toBeInTheDocument();
    expect(screen.getAllByText('LA9001')).toHaveLength(1);
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('Bruno Lima')).toBeInTheDocument();
  });

  it('voos do mesmo dia com a mesma colega viram um cartão só, sem repetir o nome', async () => {
    const day = { flightDate: '2099-03-20', partnerUserId: 'p1', partnerName: 'Ana Souza', partnerAirline: 'LATAM', crewRole: 'CC' };
    h.crewmates = [
      { ...day, flightNumber: 'LA9001', departure: 'GRU', arrival: 'REC' },
      { ...day, flightNumber: 'LA9002', departure: 'REC', arrival: 'GRU' },
    ];
    renderPage();
    expect(await screen.findByText('LA9002')).toBeInTheDocument();
    expect(screen.getByText('LA9001')).toBeInTheDocument();
    expect(screen.getAllByText('Ana Souza')).toHaveLength(1);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('tocar num colega abre as folgas e os pernoites em comum', async () => {
    h.connections = [{ partnerUserId: 'p1', partnerName: 'Ana Souza', partnerAirline: 'LATAM', flightsTogetherCount: 3, hasConversation: false, conversationId: null }];
    h.daysOff.mockResolvedValue(['2099-03-21']);
    h.layovers.mockResolvedValue([{ date: '2099-03-22', city: 'Manaus' }]);
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: /Colegas/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Ana Souza/ }));
    await waitFor(() => expect(h.daysOff).toHaveBeenCalledWith('p1'));
    expect(await screen.findByText(/21\/mar/)).toBeInTheDocument();
    expect(screen.getByText(/Manaus/)).toBeInTheDocument();
  });

  it('sem ninguém ainda: convida a tripulação, sem os atalhos antigos', async () => {
    renderPage();
    expect(await screen.findAllByRole('button', { name: /Convidar/ })).not.toHaveLength(0);
    expect(screen.queryByText('Compare folgas')).toBeNull();
    expect(screen.queryByText('Alertas de coincidência')).toBeNull();
  });
});
