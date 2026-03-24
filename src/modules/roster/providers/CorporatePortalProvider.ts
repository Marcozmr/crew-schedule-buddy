/**
 * CorporatePortalProvider — portal corporativo LATAM como ponto de autenticação.
 * Abre o portal em popup; retorno via callback EscalaX ou confirmação manual.
 * NÃO implementa scraping, automação de login, engenharia reversa ou APIs privadas.
 */

import { corporatePortalConfig, getResolvedLoginUrl, isLoginUrlConfigured, isTestMode } from '@/lib/corporate-portal-config';
import { emitRosterUpdated } from '@/lib/events/roster-events';
import { supabase } from '@/integrations/supabase/client';
import { SessionManager } from '../services/SessionManager';
import { RosterProvider } from './RosterProvider';
import type { ConnectionResult, ProviderStatus, RosterSourceInfo, RosterSyncResult } from '../types';

const AUTH_DONE_EVENT = 'escalax-corporate-auth-done';

export class CorporatePortalProvider extends RosterProvider {
  readonly id = 'corporate_portal' as const;
  readonly name = 'Portal corporativo LATAM';

  /**
   * Confirma conexão quando o portal não redireciona para o callback (fluxo honesto, manual).
   */
  confirmManualConnection(): void {
    SessionManager.setCorporatePortalConnected();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('escalax-corporate-connection-changed'));
    }
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      emitRosterUpdated({
        userId: user.id,
        reason: 'roster_connected',
        at: new Date().toISOString(),
      });
    });
  }

  async connect(): Promise<ConnectionResult> {
    if (!corporatePortalConfig.isEnabled) {
      return { success: false, error: 'Portal corporativo não está habilitado' };
    }

    if (!isLoginUrlConfigured()) {
      const msg =
        'URL do portal não configurada. Defina VITE_CORPORATE_PORTAL_LOGIN_URL no .env e reinicie o servidor de desenvolvimento.';
      SessionManager.setCorporatePortalError(msg);
      return { success: false, error: msg };
    }

    const callbackUrl = corporatePortalConfig.callbackUrl;
    if (!callbackUrl) {
      return { success: false, error: 'Callback indisponível (ambiente inválido)' };
    }

    const loginUrl = getResolvedLoginUrl();

    SessionManager.setCorporatePortalConnecting();

    const appendRedirect = corporatePortalConfig.appendRedirectUri;

    const urlToOpen = appendRedirect
      ? `${loginUrl}${loginUrl.includes('?') ? '&' : '?'}redirect_uri=${encodeURIComponent(callbackUrl)}`
      : loginUrl;

    const width = 500;
    const height = 640;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      urlToOpen,
      'corporate-auth',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );

    if (!popup) {
      SessionManager.setCorporatePortalError('Não foi possível abrir a janela. Verifique o bloqueador de pop-ups.');
      return { success: false, error: 'Bloqueador de pop-ups pode estar ativo' };
    }

    return new Promise<ConnectionResult>((resolve) => {
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type !== AUTH_DONE_EVENT) return;

        window.removeEventListener('message', handleMessage);
        clearInterval(interval);

        if (event.data.success) {
          SessionManager.setCorporatePortalConnected();
          resolve({ success: true });
        } else {
          SessionManager.setCorporatePortalError('Autenticação não concluída');
          resolve({ success: false, error: 'Autenticação não concluída' });
        }
      };

      const interval = setInterval(() => {
        if (popup.closed) {
          window.removeEventListener('message', handleMessage);
          clearInterval(interval);

          const conn = SessionManager.getCorporatePortal();
          if (conn.status !== 'connected') {
            SessionManager.setCorporatePortalDisconnected();
            resolve({
              success: false,
              error: conn.status === 'connecting'
                ? 'Janela fechada antes de concluir a autenticação'
                : undefined,
            });
          }
        }
      }, 300);

      window.addEventListener('message', handleMessage);
    });
  }

  async disconnect(): Promise<void> {
    SessionManager.disconnectCorporate();
  }

  async getStatus(): Promise<ProviderStatus> {
    const conn = SessionManager.getCorporateStatus();

    if (!corporatePortalConfig.isEnabled) {
      return { status: 'unavailable', message: 'Portal corporativo não habilitado' };
    }

    if (conn.status === 'connected') {
      return {
        status: 'connected',
        lastSyncAt: conn.connectedAt,
        message: 'Portal LATAM conectado',
      };
    }

    if (conn.status === 'connecting') {
      return { status: 'connecting', message: 'Conectando...' };
    }

    if (conn.status === 'failed') {
      return { status: 'failed', error: conn.error ?? 'Erro de conexão' };
    }

    if (isTestMode()) {
      return {
        status: 'disconnected',
        message:
          'Defina VITE_CORPORATE_PORTAL_LOGIN_URL no .env para abrir o portal LATAM (reinicie o dev server após salvar).',
      };
    }

    return { status: 'disconnected', message: 'Faça login no portal corporativo e confirme no app, se necessário.' };
  }

  async syncRoster(): Promise<RosterSyncResult> {
    return { success: false, rosterId: null, parsedCount: 0, insertedCount: 0, error: 'Indisponível' };
  }

  supportsAutoSync(): boolean {
    return false;
  }

  supportsManualImport(): boolean {
    return false;
  }

  listAvailableSources(): RosterSourceInfo[] {
    if (!corporatePortalConfig.isEnabled) {
      return [
        {
          id: 'corporate_portal',
          displayName: 'Portal corporativo LATAM',
          description: 'Acesso ao portal corporativo para autenticação',
          available: false,
          comingSoonMessage: 'Portal corporativo não habilitado',
        },
      ];
    }

    const test = isTestMode();
    return [
      {
        id: 'corporate_portal',
        displayName: 'Portal corporativo LATAM',
        description: test
          ? 'Configure VITE_CORPORATE_PORTAL_LOGIN_URL para abrir o portal no navegador.'
          : 'Acesso ao portal corporativo para autenticação (abre em nova janela).',
        available: true,
        comingSoonMessage: test ? 'URL do portal ausente no .env' : undefined,
      },
    ];
  }
}
