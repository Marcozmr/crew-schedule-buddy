import { useState, useRef, useCallback, useEffect } from 'react';
import { Plane, Upload, X, AlertTriangle, CheckCircle2, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import {
  startAutoImport,
  runFullAutoImport,
  extractRosterFromPdf,
} from '@/services/autoImport/autoImportService';
import {
  INITIAL_AUTO_IMPORT_STATE,
  AUTO_IMPORT_STATUS_LABELS,
  type AirlineId,
  type AutoImportState,
  type RosterChange,
} from '@/services/autoImport/autoImportTypes';
import {
  isRosterAutomationConfigured,
  postLatamConnect,
  postLatamSync,
  automationStatusLabelPt,
} from '@/lib/roster-automation-api';
import { useAutomationSessionFromSupabase } from '@/hooks/useAutomationSessionFromSupabase';

interface AutoImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportComplete?: (rosterId: string | null) => void;
}

const AIRLINES: { id: AirlineId; label: string; available: boolean; hint?: string }[] = [
  { id: 'LATAM', label: 'LATAM', available: true },
  { id: 'GOL', label: 'GOL', available: false, hint: 'Automação em desenvolvimento para esta companhia. Você pode importar via PDF oficial.' },
  { id: 'AZUL', label: 'Azul', available: false, hint: 'Automação em desenvolvimento para esta companhia. Você pode importar via PDF oficial.' },
  { id: 'GENERIC', label: 'Outra (PDF)', available: true },
];

const CHANGE_TYPE_LABELS: Record<string, string> = {
  flight_added: 'Voo adicionado',
  flight_removed: 'Voo removido',
  time_changed: 'Horário alterado',
  report_time_changed: 'Apresentação alterada',
  origin_changed: 'Origem alterada',
  destination_changed: 'Destino alterado',
  overnight_changed: 'Pernoite alterado',
  day_off_changed: 'Folga/Reserva alterada',
  reserve_changed: 'Reserva alterada',
};

export function AutoImportModal({ open, onClose, onImportComplete }: AutoImportModalProps) {
  const { user, session: authSession } = useAuth();
  const getAccessToken = useCallback(async () => authSession?.access_token ?? null, [authSession?.access_token]);

  const [state, setState] = useState<AutoImportState>(INITIAL_AUTO_IMPORT_STATE);
  const [selectedAirline, setSelectedAirline] = useState<AirlineId | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [workerMode, setWorkerMode] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const workerSuccessHandled = useRef(false);

  // Playwright session — only subscribes when workerMode is active
  const {
    session: automationSession,
    latestRun,
    refresh: refreshSession,
  } = useAutomationSessionFromSupabase(workerMode ? user?.id : undefined);

  const updateStatus = useCallback((status: AutoImportState['status']) => {
    setState((prev) => ({ ...prev, status }));
  }, []);

  const resetState = useCallback(() => {
    setState(INITIAL_AUTO_IMPORT_STATE);
    setShowFallback(false);
    setWorkerMode(false);
    workerSuccessHandled.current = false;
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const handleClose = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    resetState();
    setSelectedAirline(null);
    onClose();
  }, [onClose, resetState]);

  const handleAirlineSelect = useCallback((id: AirlineId) => {
    resetState();
    setSelectedAirline(id);
    const airline = AIRLINES.find((a) => a.id === id);
    if (airline && !airline.available) {
      setShowFallback(true);
    }
  }, [resetState]);

  // Map Playwright FSM state → local status
  useEffect(() => {
    if (!workerMode || !automationSession) return;
    const st = automationSession.status;

    if (st === 'portal_connecting') {
      updateStatus('waiting_login');
    } else if (st === 'portal_connected' || st === 'iflight_detected') {
      updateStatus('searching_roster');
    } else if (st === 'roster_downloading') {
      updateStatus('roster_found');
    } else if (st === 'roster_importing') {
      updateStatus('importing');
    } else if (st === 'roster_connected') {
      if (workerSuccessHandled.current) return;
      workerSuccessHandled.current = true;
      const rosterId = latestRun?.imported_roster_id ?? null;
      setState((prev) => ({ ...prev, status: 'completed', rosterId }));
      toast.success('Escala sincronizada automaticamente!');
      onImportComplete?.(rosterId);
    } else if (st === 'error' || st === 'reconnect_required') {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: automationSession.last_error ?? 'Não foi possível completar automaticamente.',
      }));
      setShowFallback(true);
    }
  }, [
    workerMode,
    automationSession,
    latestRun?.imported_roster_id,
    updateStatus,
    onImportComplete,
  ]);

  // Escuta postMessage do CorporateAuthCallbackPage (/auth/corporate-callback)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'escalax-corporate-auth-done') return;
      if (pollRef.current) clearInterval(pollRef.current);
      if (event.data.success) {
        setState((prev) => ({ ...prev, status: 'login_detected' }));
        setShowFallback(true);
      } else {
        setState((prev) => ({ ...prev, status: 'error', error: 'Autenticação não concluída no portal.' }));
        setShowFallback(true);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Playwright worker connect for LATAM
  const handleConnectWorker = useCallback(async () => {
    if (!user || !selectedAirline) return;
    setWorkerMode(true);
    workerSuccessHandled.current = false;
    setState((prev) => ({ ...prev, status: 'opening_portal', airline: selectedAirline, error: null }));

    try {
      await postLatamConnect(getAccessToken);
      // Status updates will come via useAutomationSessionFromSupabase polling
      updateStatus('waiting_login');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao iniciar automação';
      setState((prev) => ({ ...prev, status: 'error', error: msg }));
      setShowFallback(true);
      setWorkerMode(false);
    }
  }, [user, selectedAirline, getAccessToken, updateStatus]);

  // Retry via worker (sync if session exists, connect if not)
  const handleWorkerRetry = useCallback(async () => {
    if (!user) return;
    setState((prev) => ({ ...prev, status: 'searching_roster', error: null }));
    workerSuccessHandled.current = false;
    try {
      if (automationSession?.id && automationSession.status !== 'reconnect_required') {
        await postLatamSync(getAccessToken, automationSession.id);
      } else {
        await postLatamConnect(getAccessToken);
      }
      await refreshSession();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao tentar novamente';
      setState((prev) => ({ ...prev, status: 'error', error: msg }));
    }
  }, [user, automationSession, getAccessToken, refreshSession]);

  // Popup flow (non-LATAM or LATAM without worker configured)
  const handleOpenPortal = useCallback(() => {
    if (!selectedAirline || !user) return;

    setState((prev) => ({ ...prev, status: 'opening_portal', airline: selectedAirline, error: null }));

    const popup = startAutoImport(selectedAirline);
    if (!popup) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: 'Não foi possível abrir o portal. Verifique o bloqueador de pop-ups.',
      }));
      setShowFallback(true);
      return;
    }
    popupRef.current = popup;

    setState((prev) => ({ ...prev, status: 'waiting_login' }));

    pollRef.current = setInterval(() => {
      if (!popupRef.current || popupRef.current.closed) {
        if (pollRef.current) clearInterval(pollRef.current);
        setState((prev) => {
          if (prev.status === 'waiting_login') {
            setShowFallback(true);
            return { ...prev, status: 'login_detected' };
          }
          return prev;
        });
      }
    }, 500);
  }, [selectedAirline, user]);

  const handleManualPdfSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAirline || !user) return;
    e.target.value = '';

    setState((prev) => ({ ...prev, status: 'importing', airline: selectedAirline, error: null }));

    try {
      updateStatus('searching_roster');
      const roster = await extractRosterFromPdf(selectedAirline, file);

      if (!roster.rawText.trim() && !roster.entries.length) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: 'Não foi possível extrair dados do PDF. Verifique se é um CrewRoster oficial.',
        }));
        return;
      }

      const result = await runFullAutoImport(
        selectedAirline,
        { pdfFile: file },
        user.id,
        updateStatus,
      );

      if (result.success) {
        setState((prev) => ({ ...prev, status: 'completed', changes: result.changes, rosterId: result.rosterId }));
        toast.success(`Importação concluída — ${result.insertedCount} entradas salvas`);
        onImportComplete?.(result.rosterId);
      } else {
        setState((prev) => ({ ...prev, status: 'error', error: result.error ?? 'Erro ao importar' }));
        toast.error(result.error ?? 'Erro ao importar PDF');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setState((prev) => ({ ...prev, status: 'error', error: msg }));
      toast.error(msg);
    }
  }, [selectedAirline, user, updateStatus, onImportComplete]);

  const isLatamWithWorker = selectedAirline === 'LATAM' && isRosterAutomationConfigured();
  const isLoading = ['opening_portal', 'waiting_login', 'login_detected', 'searching_roster', 'roster_found', 'importing', 'comparing'].includes(state.status);
  const isCompleted = state.status === 'completed';
  const isError = state.status === 'error';

  // When in worker mode, use Playwright status labels for better accuracy
  const statusLabel = workerMode && automationSession
    ? automationStatusLabelPt(automationSession.status)
    : AUTO_IMPORT_STATUS_LABELS[state.status];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md w-full" aria-describedby="auto-import-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-primary" />
            Importar Escala Automaticamente
          </DialogTitle>
        </DialogHeader>

        <p id="auto-import-desc" className="text-sm text-muted-foreground">
          Selecione a companhia e importe sua escala diretamente do portal oficial ou via PDF.
        </p>

        {/* Seleção de companhia */}
        <div className="grid grid-cols-2 gap-2">
          {AIRLINES.map((a) => (
            <button
              key={a.id}
              onClick={() => handleAirlineSelect(a.id)}
              disabled={isLoading}
              className={[
                'rounded-lg border-2 px-3 py-3 text-sm font-medium transition-colors text-left',
                selectedAirline === a.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card hover:border-primary/50 hover:bg-accent',
                isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              <span className="block">{a.label}</span>
              {a.id === 'LATAM' && isRosterAutomationConfigured() && (
                <Badge variant="secondary" className="mt-1 text-[10px] bg-primary/10 text-primary border-primary/20">Auto</Badge>
              )}
              {!a.available && (
                <Badge variant="secondary" className="mt-1 text-[10px]">Em breve</Badge>
              )}
            </button>
          ))}
        </div>

        {/* Aviso de companhia sem suporte ainda */}
        {showFallback && selectedAirline && !isLatamWithWorker && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium mb-1">Automação em desenvolvimento</p>
            <p>Para esta companhia, você pode importar via PDF oficial usando o botão abaixo.</p>
          </div>
        )}

        {/* Worker mode: instrução sobre o que está acontecendo */}
        {workerMode && isLoading && (
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-0.5">Automação em execução no servidor</p>
            <p>O EscalaX está acessando o portal LATAM automaticamente. Se for o primeiro acesso, você precisará concluir o login no browser que o servidor abrirá.</p>
          </div>
        )}

        {/* Worker error: fallback PDF sugerido */}
        {workerMode && isError && showFallback && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium mb-1">Importação automática indisponível</p>
            <p>{state.error ?? 'Tente novamente ou importe o PDF da escala manualmente abaixo.'}</p>
          </div>
        )}

        {/* Status atual */}
        {state.status !== 'idle' && (
          <div className={[
            'rounded-lg border p-3 flex items-start gap-3',
            isError ? 'border-destructive/50 bg-destructive/10' : '',
            isCompleted ? 'border-green-500/50 bg-green-50 dark:bg-green-900/20' : '',
            isLoading ? 'border-primary/30 bg-primary/5' : '',
          ].join(' ')}>
            {isLoading && <Loader2 className="h-4 w-4 mt-0.5 animate-spin text-primary shrink-0" />}
            {isCompleted && <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />}
            {isError && <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{statusLabel}</p>
              {state.error && !showFallback && (
                <p className="text-xs text-destructive mt-0.5">{state.error}</p>
              )}
            </div>
          </div>
        )}

        {/* Aviso obrigatório */}
        {selectedAirline && (
          <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
            Confira sempre horários críticos no portal oficial da companhia.
          </p>
        )}

        {/* Lista de mudanças */}
        {isCompleted && state.changes.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-semibold">{state.changes.length} alteração(ões) detectada(s):</p>
            <ul className="space-y-1 max-h-40 overflow-y-auto">
              {state.changes.map((c: RosterChange, i: number) => (
                <li key={i} className="text-xs bg-muted/40 rounded px-2 py-1.5">
                  <span className="font-medium text-primary">{CHANGE_TYPE_LABELS[c.type] ?? c.type}</span>
                  <span className="text-muted-foreground"> · {c.date}</span>
                  <span className="block text-muted-foreground">{c.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isCompleted && state.changes.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-1">Nenhuma alteração em relação à escala anterior.</p>
        )}

        {/* Ações */}
        <div className="flex flex-col gap-2 pt-1">
          {/* LATAM + Playwright worker */}
          {isLatamWithWorker && !isCompleted && !isLoading && (
            <Button onClick={handleConnectWorker} className="w-full">
              <Sparkles className="mr-2 h-4 w-4" />
              Sincronizar automaticamente
            </Button>
          )}

          {/* Popup portal (non-LATAM, ou LATAM sem worker configurado) */}
          {!isLatamWithWorker && selectedAirline && !isCompleted && !isLoading && (
            <Button
              onClick={handleOpenPortal}
              disabled={isLoading || !selectedAirline || showFallback}
              className="w-full"
            >
              <Plane className="mr-2 h-4 w-4" />
              Entrar no portal
            </Button>
          )}

          {/* PDF fallback — sempre disponível após seleção */}
          {(showFallback || isError || (selectedAirline && !isLatamWithWorker)) && (
            <Button
              variant="outline"
              onClick={handleManualPdfSelect}
              disabled={isLoading}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isError ? 'Tentar com PDF manual' : 'Importar via PDF'}
            </Button>
          )}

          {/* Retry */}
          {isError && (
            <Button
              variant="ghost"
              size="sm"
              onClick={workerMode ? handleWorkerRetry : resetState}
              className="w-full text-muted-foreground"
            >
              <RefreshCw className="mr-2 h-3 w-3" />
              Tentar novamente
            </Button>
          )}

          {isCompleted && (
            <Button onClick={handleClose} className="w-full">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Concluído
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={handleClose} className="w-full text-muted-foreground">
            <X className="mr-2 h-3 w-3" />
            Cancelar
          </Button>
        </div>

        {/* Input de arquivo oculto */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.html"
          className="hidden"
          onChange={handleFileChange}
        />
      </DialogContent>
    </Dialog>
  );
}
