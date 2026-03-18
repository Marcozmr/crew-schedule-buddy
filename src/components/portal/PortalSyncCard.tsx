import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link2, RefreshCw, ShieldCheck, Unplug, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { formatDateTimeBR } from '@/lib/date-utils';
import { PdfImportDialog } from '@/components/PdfImportDialog';
import {
  disconnectPortalConnection,
  ensurePortalConnection,
  getPortalConnection,
  listRecentPortalSyncRuns,
  markPortalConnectedFromSession,
  startPortalConnection,
  syncPortalConnection,
} from '@/lib/services/portal-sync-service';
import { PROVIDER_TOKEN_STORAGE_KEY, type PortalConnectionRecord, type PortalSyncRunRecord } from '@/lib/portal/types';

interface PortalSyncCardProps {
  onSyncComplete?: () => void;
}

export function PortalSyncCard({ onSyncComplete }: PortalSyncCardProps) {
  const { user, providerToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connection, setConnection] = useState<PortalConnectionRecord | null>(null);
  const [runs, setRuns] = useState<PortalSyncRunRecord[]>([]);

  const effectiveToken = providerToken ?? localStorage.getItem(PROVIDER_TOKEN_STORAGE_KEY);
  const hasSecureSession = Boolean(effectiveToken);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const ensured = await ensurePortalConnection(user.id);
    const [latestConnection, latestRuns] = await Promise.all([
      getPortalConnection(user.id),
      listRecentPortalSyncRuns(user.id),
    ]);
    setConnection(latestConnection ?? ensured);
    setRuns(latestRuns);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user || !hasSecureSession) return;
    void markPortalConnectedFromSession(user.id).then((updated) => setConnection(updated));
  }, [user, hasSecureSession]);

  const connectionLabel = useMemo(() => {
    if (loading) return 'Sincronização indisponível';
    if (hasSecureSession && connection?.connection_status !== 'disconnected') return 'Portal conectado';
    if (connection?.connection_status === 'pending') return 'Sincronização indisponível';
    if (connection?.connection_status === 'expired') return 'Sincronização indisponível';
    return 'Sincronização indisponível';
  }, [connection?.connection_status, hasSecureSession, loading]);

  const syncLabel = hasSecureSession && connection?.connection_status !== 'disconnected'
    ? 'Sincronização ativa'
    : 'Sincronização indisponível';

  const handleConnect = async () => {
    if (!user) return;
    setConnecting(true);
    try {
      await startPortalConnection(user.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível conectar ao portal.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;
    setDisconnecting(true);
    try {
      const updated = await disconnectPortalConnection(user.id);
      setConnection(updated);
      toast.success('Portal desconectado.');
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível desconectar o portal.');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSync = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const { connection: updatedConnection, execution } = await syncPortalConnection({
        userId: user.id,
        providerToken: effectiveToken,
      });
      setConnection(updatedConnection);
      await refresh();

      if (execution.status === 'success') {
        toast.success(`${execution.importedCount} registro(s) sincronizado(s).`);
      } else if (execution.status === 'noop') {
        toast.info(execution.reason ?? 'Sem novas alterações para sincronizar.');
      } else {
        toast.error(execution.error ?? 'Falha ao sincronizar o portal.');
      }

      onSyncComplete?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao sincronizar o portal.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="glass p-5 sm:p-6 min-w-0 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-w-0">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Link2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <h3 className="font-semibold text-foreground break-words">Conectar ao portal</h3>
            <p className="text-sm text-muted-foreground break-words">
              Conecte a fonte oficial da escala para sincronizar automaticamente, mantendo a importação manual como alternativa segura.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="max-w-full">{connectionLabel}</Badge>
          <Badge variant="outline" className="max-w-full">{syncLabel}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
        <div className="rounded-xl border border-border bg-background/60 p-4 min-w-0">
          <p className="text-xs text-muted-foreground">Última sincronização</p>
          <p className="text-sm font-medium text-foreground mt-1 break-words">
            {connection?.last_synced_at ? formatDateTimeBR(connection.last_synced_at) : 'Ainda não realizada'}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background/60 p-4 min-w-0">
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="text-sm font-medium text-foreground mt-1 break-words">{syncLabel}</p>
          {connection?.last_error && (
            <p className="text-xs text-muted-foreground mt-1 break-words">{connection.last_error}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 min-w-0">
        <Button onClick={() => void handleConnect()} disabled={connecting} className="w-full sm:w-auto">
          <ShieldCheck className="w-4 h-4 mr-2 shrink-0" />
          {connecting ? 'Conectando...' : 'Conectar ao portal'}
        </Button>
        <Button variant="outline" onClick={() => void handleSync()} disabled={syncing || !hasSecureSession} className="w-full sm:w-auto">
          <RefreshCw className={`w-4 h-4 mr-2 shrink-0 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
        </Button>
        <Button variant="outline" onClick={() => void handleDisconnect()} disabled={disconnecting} className="w-full sm:w-auto">
          <Unplug className="w-4 h-4 mr-2 shrink-0" />
          {disconnecting ? 'Desconectando...' : 'Desconectar portal'}
        </Button>
        <PdfImportDialog
          onImportComplete={onSyncComplete}
          trigger={
            <Button variant="ghost" className="w-full sm:w-auto">
              <Upload className="w-4 h-4 mr-2 shrink-0" />
              Importar PDF manualmente
            </Button>
          }
        />
      </div>

      <div className="rounded-xl border border-border bg-background/40 p-4 min-w-0 space-y-2">
        <p className="text-xs font-medium text-foreground">Histórico recente</p>
        {runs.length > 0 ? (
          <div className="space-y-2">
            {runs.map((run) => (
              <div key={run.id} className="flex flex-col gap-1 rounded-lg bg-background/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between min-w-0">
                <div className="min-w-0">
                  <p className="text-sm text-foreground break-words">
                    {run.run_status === 'success'
                      ? 'Sincronização concluída'
                      : run.run_status === 'noop'
                        ? 'Sincronização sem mudanças'
                        : run.run_status === 'pending'
                          ? 'Sincronização em andamento'
                          : 'Sincronização com erro'}
                  </p>
                  <p className="text-xs text-muted-foreground break-words">{formatDateTimeBR(run.started_at)}</p>
                </div>
                <p className="text-xs text-muted-foreground break-words">
                  {run.imported_count > 0 ? `${run.imported_count} registro(s)` : run.error_message || 'Sem novas alterações'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground break-words">Nenhuma sincronização registrada ainda.</p>
        )}
      </div>
    </div>
  );
}
