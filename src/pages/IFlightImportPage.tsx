import { useCallback, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { importScheduleFromGmail, isGmailScopeError } from '@/lib/gmail-import';
import { FileText, DownloadCloud } from 'lucide-react';
import { toast } from 'sonner';

type SyncState = {
  importedCount: number;
  parsedCount: number;
  reason?: string;
} | null;

const PROVIDER_TOKEN_KEY = 'google_provider_token';

export default function IFlightImportPage() {
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>(null);

  const runSync = useCallback(async () => {
    if (!user) return;

    const providerTokenFromSession = (session as { provider_token?: string | null } | null)?.provider_token ?? null;
    if (providerTokenFromSession) {
      sessionStorage.setItem(PROVIDER_TOKEN_KEY, providerTokenFromSession);
    }

    const providerToken = providerTokenFromSession ?? sessionStorage.getItem(PROVIDER_TOKEN_KEY);

    if (!providerToken) {
      toast.error('Token do Google ausente. Faça logout e login novamente para autorizar o Gmail.');
      return;
    }

    setLoading(true);
    setSyncState(null);

    try {
      const result = await importScheduleFromGmail(user.id, providerToken, {
        subject: 'IFlight',
        filenameBase: 'CrewRosterReport',
      });

      setSyncState({
        importedCount: result.importedCount,
        parsedCount: result.parsedCount,
        reason: result.reason,
      });

      if (result.importedCount > 0) {
        toast.success(`Importação concluída: ${result.importedCount} voo(s) salvo(s).`);
      } else {
        toast.info(result.reason ?? 'PDF encontrado e salvo, sem novos voos para inserir.');
      }
    } catch (error) {
      if (isGmailScopeError(error)) {
        toast.error('Permissão Gmail ausente. Refaça o login com Google para liberar leitura de e-mail.');
      } else {
        toast.error('Falha ao buscar o CrewRosterReport no e-mail IFlight.');
      }
    } finally {
      setLoading(false);
    }
  }, [user, session]);

  return (
    <AppLayout>
      <div className="max-w-3xl">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Importar PDF IFlight</h1>
        <p className="text-muted-foreground mt-2">
          Esta rota procura no Gmail apenas e-mails com assunto <strong>IFlight</strong> e anexo
          <strong> CrewRosterReport</strong>, salva o PDF no app e processa os voos.
        </p>

        <div className="mt-6 bg-card border border-border rounded-xl p-6 shadow-card">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-5 h-5 text-primary" />
            <p className="font-medium text-foreground">Rota dedicada de sincronização</p>
          </div>

          <Button onClick={() => void runSync()} disabled={loading} className="gradient-sky text-primary-foreground">
            <DownloadCloud className="w-4 h-4 mr-2" />
            {loading ? 'Sincronizando...' : 'Buscar CrewRosterReport agora'}
          </Button>

          {syncState && (
            <div className="mt-4 rounded-lg bg-muted p-4 text-sm text-foreground">
              <p>Voos importados: <strong>{syncState.importedCount}</strong></p>
              <p>Voos detectados no PDF: <strong>{syncState.parsedCount}</strong></p>
              {syncState.reason && <p className="text-muted-foreground mt-1">{syncState.reason}</p>}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
