/**
 * AzulProvider — Azul Linhas Aéreas, sistema CAE (Crew Activity Engine).
 *
 * Fluxo:
 *  1. Abre o portal CAE no browser do usuário (popup)
 *  2. Usuário se autentica
 *  3. Ao fechar o popup, notifica o serviço de automação (/v1/azul/connect)
 *     para iniciar captura do MonthlySchedule via sessão persistida
 */

import { isRosterAutomationConfigured, postAzulConnect, getAzulSession } from '@/lib/roster-automation-api';
import { supabase } from '@/integrations/supabase/client';
import { RosterProvider } from './RosterProvider';
import type { ConnectionResult, ProviderStatus, RosterSourceInfo, RosterSyncResult } from '../types';

const AZUL_CAE_URL =
  import.meta.env.VITE_AZUL_PORTAL_URL?.trim() || 'https://cae.voeazul.com.br';

const SESSION_KEY = 'escalax_azul_session_id';

export class AzulProvider extends RosterProvider {
  readonly id = 'azul' as const;
  readonly name = 'Azul — CAE';

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

    // Open Azul CAE portal in popup for user authentication
    const width = 500;
    const height = 680;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      AZUL_CAE_URL,
      'azul-auth',
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

    // Notify backend automation to start Azul CAE session capture
    try {
      const { sessionId } = await postAzulConnect(this.getAccessToken.bind(this));
      this.saveSessionId(sessionId);
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Falha ao iniciar sessão Azul' };
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
    if (!sessionId) return { status: 'disconnected', message: 'Conecte ao portal Azul CAE para importar sua escala' };

    try {
      const { session } = await getAzulSession(this.getAccessToken.bind(this), sessionId);
      const status = (session as { status?: string }).status ?? 'disconnected';

      if (status === 'roster_connected') return { status: 'connected', message: 'Escala Azul importada com sucesso' };
      if (status === 'portal_connecting') return { status: 'connecting', message: 'Aguardando autenticação Azul CAE…' };
      if (status === 'roster_downloading') return { status: 'syncing', message: 'Baixando escala Azul…' };
      if (status === 'error') return { status: 'failed', error: (session as { last_error?: string }).last_error ?? 'Erro na importação' };

      return { status: 'disconnected' };
    } catch {
      return { status: 'disconnected' };
    }
  }

  async syncRoster(): Promise<RosterSyncResult> {
    return { success: false, rosterId: null, parsedCount: 0, insertedCount: 0, error: 'Use Conectar para iniciar a sincronização Azul' };
  }

  supportsAutoSync(): boolean { return true; }
  supportsManualImport(): boolean { return false; }

  listAvailableSources(): RosterSourceInfo[] {
    return [
      {
        id: 'azul',
        displayName: 'Azul — CAE',
        description: 'Importação automática via portal CAE (Crew Activity Engine)',
        available: isRosterAutomationConfigured(),
        comingSoonMessage: isRosterAutomationConfigured()
          ? undefined
          : 'Configure VITE_ROSTER_AUTOMATION_URL para habilitar',
      },
    ];
  }
}
