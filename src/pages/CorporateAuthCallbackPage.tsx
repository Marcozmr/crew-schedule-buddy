/**
 * Retorno da autenticação corporativa (portal LATAM → EscalaX).
 * Valida parâmetros, atualiza estado UX (sem credenciais), notifica o opener e fecha o popup.
 * Use ?manual=1 para apenas confirmação manual (sem auto-retorno OAuth).
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { emitRosterUpdated } from '@/lib/events/roster-events';
import { supabase } from '@/integrations/supabase/client';
import { SessionManager } from '@/modules/roster/services/SessionManager';
import { UserRosterConnectionService } from '@/modules/roster/services/UserRosterConnectionService';

export const AUTH_DONE_EVENT = 'escalax-corporate-auth-done';

function notifyOpener(success: boolean) {
  if (window.opener) {
    try {
      window.opener.postMessage({ type: AUTH_DONE_EVENT, success }, window.location.origin);
    } catch {
      // ignorar
    }
  }
}

export default function CorporateAuthCallbackPage() {
  const [mode, setMode] = useState<'processing' | 'done' | 'error' | 'manual'>('processing');
  const ran = useRef(false);

  const finishSuccess = useCallback(() => {
    SessionManager.setCorporatePortalConnected();
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        await UserRosterConnectionService.setRosterConnectionState(user.id, 'portal_connected');
        emitRosterUpdated({
          userId: user.id,
          reason: 'active_roster_changed',
          at: new Date().toISOString(),
        });
      }
    });
    notifyOpener(true);
    setMode('done');
    if (window.opener) {
      window.setTimeout(() => window.close(), 900);
    } else {
      window.setTimeout(() => {
        window.location.href = '/download-roster';
      }, 1200);
    }
  }, []);

  const finishError = useCallback(() => {
    SessionManager.setCorporatePortalError('Autenticação não concluída');
    notifyOpener(false);
    setMode('error');
    if (window.opener) {
      window.setTimeout(() => window.close(), 2000);
    } else {
      window.setTimeout(() => {
        window.location.href = '/download-roster';
      }, 2000);
    }
  }, []);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);

    if (params.get('manual') === '1') {
      setMode('manual');
      return;
    }

    if (params.get('success') === 'false') {
      finishError();
      return;
    }

    finishSuccess();
  }, [finishSuccess, finishError]);

  const handleManualConfirm = () => {
    finishSuccess();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      {mode === 'processing' && (
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Validando retorno...</p>
        </div>
      )}

      {mode === 'done' && (
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <CheckCircle className="w-12 h-12 text-success" />
          <p className="font-medium text-foreground">Portal LATAM conectado</p>
          <p className="text-sm text-muted-foreground">
            {window.opener ? 'Retornando ao EscalaX...' : 'Redirecionando...'}
          </p>
        </div>
      )}

      {mode === 'error' && (
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <p className="font-medium text-foreground">Não foi possível validar a conexão</p>
          <p className="text-sm text-muted-foreground">Você pode tentar novamente no aplicativo.</p>
        </div>
      )}

      {mode === 'manual' && (
        <div className="flex flex-col items-center gap-6 max-w-md text-center">
          <p className="font-medium text-foreground">Confirmação manual</p>
          <p className="text-sm text-muted-foreground">
            Após concluir o login no portal LATAM, confirme abaixo para registrar a conexão no EscalaX (somente se a
            autenticação foi bem-sucedida).
          </p>
          <Button type="button" onClick={handleManualConfirm} className="w-full max-w-sm">
            Concluí o login no portal
          </Button>
        </div>
      )}
    </div>
  );
}
