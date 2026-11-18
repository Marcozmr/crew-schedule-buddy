import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  native: true,
  syncPortal: vi.fn(),
  connectPortal: vi.fn(),
  resetPortal: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => h.native } }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/lib/pdf-import', () => ({ importPdfArrayBuffer: vi.fn() }));
vi.mock('../portal-session', () => ({
  STEP_LABELS: { conectando: 'Conectando ao portal', lendo: 'Lendo sua escala', salvando: 'Salvando no aparelho', pronto: 'Pronto' },
  syncPortal: h.syncPortal,
  connectPortal: h.connectPortal,
  resetPortal: h.resetPortal,
}));

import { DevicePortalCard } from './DevicePortalCard';
import { savePortalState } from '../session-store';

beforeEach(() => {
  localStorage.clear();
  h.native = true;
  vi.clearAllMocks();
});

describe('DevicePortalCard', () => {
  it('fora do app instalado não aparece', () => {
    h.native = false;
    const { container } = render(<DevicePortalCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('nunca conectado: oferece "Conectar iFlight"', () => {
    render(<DevicePortalCard />);
    expect(screen.getByText('iFlight — LATAM')).toBeInTheDocument();
    expect(screen.getByText('Não conectado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Conectar iFlight' })).toBeInTheDocument();
  });

  it('sessão salva: mostra "Sessão salva", Sincronizar e Reconectar', () => {
    savePortalState('latam', { status: 'saved', lastSyncAt: '2026-11-18T16:03:00.000Z' });
    render(<DevicePortalCard />);
    expect(screen.getByText('Sessão salva')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sincronizar escala' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reconectar' })).toBeInTheDocument();
  });

  it('sincronizar com sessão expirada pede para reconectar', async () => {
    savePortalState('latam', { status: 'saved', learned: { method: 'GET', url: 'https://iflightla.ibsplc.aero/r' } });
    h.syncPortal.mockImplementation(async () => {
      savePortalState('latam', { status: 'expired' });
      return { kind: 'login_required' };
    });
    render(<DevicePortalCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Sincronizar escala' }));

    await waitFor(() => expect(screen.getByText('Sessão expirada. Toque em Reconectar.')).toBeInTheDocument());
    expect(screen.getByText('Sessão expirada')).toBeInTheDocument();
  });

  it('sincronizar sem caminho aprendido abre a conexão visível', async () => {
    savePortalState('latam', { status: 'saved' });
    h.syncPortal.mockResolvedValue({ kind: 'needs_connect' });
    h.connectPortal.mockResolvedValue({ kind: 'cancelled' });
    render(<DevicePortalCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Sincronizar escala' }));

    await waitFor(() => expect(h.connectPortal).toHaveBeenCalled());
  });
});
