import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { useAutomationSessionFromSupabase } from '@/hooks/useAutomationSessionFromSupabase';
import { useLatamAutomationBootstrap } from '@/hooks/useLatamAutomationBootstrap';
import {
  decideLatamAutomationKick,
  mapAutomationToUiPhase,
} from '@/lib/roster/automation-ui-phase';
import { postLatamConnect, postLatamSync } from '@/lib/roster-automation-api';
import { formatDateTimeBR } from '@/lib/date-utils';
import { emitRosterUpdated } from '@/lib/events/roster-events';
import { reportOperationalEvent } from '@/lib/monitoring/errorReporting';
import { toast } from 'sonner';

export interface AutomationStatusCardProps {
  /** Exibir card e subscrever tabelas. */
  active: boolean;
  onRosterActivated?: () => void;
}

/**
 * Estado da automação LATAM no servidor — progresso, sucesso, erro recuperável.
 * Textos em português, sem jargão de API.
 */
export function AutomationStatusCard({
  active,
  onRosterActivated,
}: AutomationStatusCardProps) {
  const { user, session: authSession } = useAuth();
  const getAccessToken = useCallback(async () => authSession?.access_token ?? null, [authSession?.access_token]);

  const { session, latestRun, loading, fetchError, refresh } = useAutomationSessionFromSupabase(
    active ? user?.id : undefined,
  );

  const [retryNonce, setRetryNonce] = useState(0);
  const [manualRetryBusy, setManualRetryBusy] = useState(false);
  const successHandled = useRef(false);

  useEffect(() => {
    if (session?.status !== 'roster_connected') {
      successHandled.current = false;
    }
  }, [session?.status]);

  const schemaError = Boolean(fetchError);

  useLatamAutomationBootstrap({
    enabled: active && Boolean(user),
    getAccessToken,
    session,
    latestRun,
    dataLoading: loading,
    schemaError,
    retryNonce,
  });

  const ui = mapAutomationToUiPhase(session, latestRun);
  const showSpinner =
    ui.phase === 'connecting' || ui.phase === 'searching' || ui.phase === 'importing' || ui.phase === 'idle';

  useEffect(() => {
    if (session?.status !== 'roster_connected' || !user) return;
    if (successHandled.current) return;
    successHandled.current = true;
    reportOperationalEvent('roster_automation_reached_connected', {
      flow: 'roster_automation',
      extra: { sessionId: session.id },
    });
    toast.success('Escala ativada', { description: 'Sua escala oficial está ativa no EscalaX.' });
    emitRosterUpdated({
      userId: user.id,
      reason: 'roster_connected',
      at: new Date().toISOString(),
    });
    onRosterActivated?.();
  }, [session?.status, session?.id, user, onRosterActivated]);

  const handleManualRetry = useCallback(async () => {
    if (!user) return;
    setManualRetryBusy(true);
    setRetryNonce((n) => n + 1);
    try {
      const kick = decideLatamAutomationKick(session, latestRun);
      if (kick?.action === 'sync' && session?.id) {
        await postLatamSync(getAccessToken, session.id);
      } else if (kick?.action === 'connect' || !session?.id) {
        await postLatamConnect(getAccessToken);
      } else if (session?.id) {
        await postLatamSync(getAccessToken, session.id);
      }
      toast.message('Tentando novamente', { description: 'Retomamos a busca da sua escala.' });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível retomar agora.');
    } finally {
      setManualRetryBusy(false);
    }
  }, [user, session, latestRun, getAccessToken, refresh]);

  if (!active || !user) return null;

  if (schemaError) {
    return (
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 space-y-2">
        <p className="text-sm font-medium text-foreground">Indisponível no momento</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Não foi possível ler o estado da sincronização. Verifique a sua ligação ou tente mais tarde.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-card p-4 sm:p-5 space-y-3 shadow-sm">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-primary/12 flex items-center justify-center shrink-0">
          {ui.phase === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-success" />
          ) : showSpinner ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5 text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold text-foreground text-sm sm:text-base leading-snug">{ui.title}</p>
          {ui.detail && (
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed break-words">{ui.detail}</p>
          )}
          {session?.updated_at && ui.phase === 'success' && (
            <p className="text-xs text-muted-foreground pt-1">
              Última atualização: {formatDateTimeBR(session.updated_at)}
            </p>
          )}
        </div>
      </div>

      {ui.phase === 'recoverable' && (
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="w-full sm:w-auto gap-2"
              disabled={manualRetryBusy}
              onClick={() => void handleManualRetry()}
            >
              {manualRetryBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Tentar novamente
            </Button>
            {session?.status === 'reconnect_required' && (
              <Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" asChild>
                <Link to="/conectar-escala">Reconectar portal</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
