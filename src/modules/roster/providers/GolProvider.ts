/**
 * GolProvider — GOL Linhas Aéreas, sistema CrewLink/IADP (portal e-Component).
 *
 * Fluxo:
 *  1. Abre o portal e-Component no browser do usuário (popup)
 *  2. Usuário se autentica (CPF + ANAC)
 *  3. Ao fechar o popup, notifica o serviço de automação (/v1/gol/connect)
 *     para iniciar captura da escala via sessão persistida
 */

import { isRosterAutomationConfigured, postGolConnect, getGolSession } from '@/lib/roster-automation-api';
import { supabase } from '@/integrations/supabase/client';
import { RosterProvider } from './RosterProvider';
import type { ConnectionResult, ProviderStatus, RosterSourceInfo, RosterSyncResult } from '../types';

const GOL_PORTAL_URL =
  import.meta.env.VITE_GOL_PORTAL_URL?.trim() || 'https://portal-escala.voegol.com.br';

const SESSION_KEY = 'escalax_gol_session_id';

export class GolProvider extends RosterProvider {
  readonly id = 'gol' as const;
  readonly name = 'GOL — CrewLink/IADP';

  private getSessionId(): string | null {
    return localStorage.getItem(SESSION_KEY);
  }

  private saveSessionId(id: string) {
    localStorage.setItem(SESSION_KEY, id);
  }

  private clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  private async getAccessToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async connect(): Promise<ConnectionResult> {
    if (!isRosterAutomationConfigured()) {
      return { success: false, error: 'Serviço de automação não configurado (VITE_ROSTER_AUTOMATION_URL)' };
    }

    // Open GOL portal in popup for user authentication
    const width = 500;
    const height = 680;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      GOL_PORTAL_URL,
      'gol-auth',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`,
    );

    if (!popup) {
      return { success: false, error: 'Bloqueador de pop-ups ativo — permita pop-ups para este site' };
    }

    await new Promise<void>((resolve) => {
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          resolve();
        }
      }, 400);
    });

    // Notify backend automation to start GOL session capture
    try {
      const { sessionId } = await postGolConnect(this.getAccessToken.bind(this));
      this.saveSessionId(sessionId);
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Falha ao iniciar sessão GOL' };
    }
  }

  async disconnect(): Promise<void> {
    this.clearSession();
  }

  async getStatus(): Promise<ProviderStatus> {
    if (!isRosterAutomationConfigured()) {
      return { status: 'unavailable', message: 'Serviço de automação não configurado' };
    }

    const sessionId = this.getSessionId();
    if (!sessionId) return { status: 'disconnected', message: 'Conecte ao portal GOL para importar sua escala' };

    try {
      const { session } = await getGolSession(this.getAccessToken.bind(this), sessionId);
      const status = (session as { status?: string }).status ?? 'disconnected';

      if (status === 'roster_connected') return { status: 'connected', message: 'Escala GOL importada com sucesso' };
      if (status === 'portal_connecting') return { status: 'connecting', message: 'Aguardando autenticação GOL…' };
      if (status === 'roster_downloading') return { status: 'syncing', message: 'Baixando escala GOL…' };
      if (status === 'error') return { status: 'failed', error: (session as { last_error?: string }).last_error ?? 'Erro na importação' };

      return { status: 'disconnected' };
    } catch {
      return { status: 'disconnected' };
    }
  }

  async syncRoster(): Promise<RosterSyncResult> {
    return { success: false, rosterId: null, parsedCount: 0, insertedCount: 0, error: 'Use Conectar para iniciar a sincronização GOL' };
  }

  supportsAutoSync(): boolean { return true; }
  supportsManualImport(): boolean { return false; }

  listAvailableSources(): RosterSourceInfo[] {
    return [
      {
        id: 'gol',
        displayName: 'GOL — CrewLink/IADP',
        description: 'Importação automática via portal e-Component (CPF + ANAC)',
        available: isRosterAutomationConfigured(),
        comingSoonMessage: isRosterAutomationConfigured()
          ? undefined
          : 'Configure VITE_ROSTER_AUTOMATION_URL para habilitar',
      },
    ];
  }
}
