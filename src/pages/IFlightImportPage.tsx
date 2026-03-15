import { useCallback, useMemo, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { importScheduleFromGmail, isGmailScopeError, type ImportDiagnostic } from '@/lib/gmail-import';
import { FileText, DownloadCloud } from 'lucide-react';
import { toast } from 'sonner';

type SyncState = {
  importedCount: number;
  parsedCount: number;
  reason?: string;
  parserError?: string;
  diagnostic: ImportDiagnostic;
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
      localStorage.setItem(PROVIDER_TOKEN_KEY, providerTokenFromSession);
    }

    const providerToken = providerTokenFromSession ?? localStorage.getItem(PROVIDER_TOKEN_KEY);

    if (!providerToken) {
      toast.error('Token do Google ausente. Faça logout e login novamente para autorizar o Gmail.');
      return;
    }

    setLoading(true);
    setSyncState(null);

    try {
      const result = await importScheduleFromGmail(user.id, providerToken, {
        searchQuery: 'has:attachment filename:pdf newer_than:180d',
        subjectContains: 'CrewRosterReport',
        senderContains: 'iFlight',
      });

      setSyncState({
        importedCount: result.importedCount,
        parsedCount: result.parsedCount,
        reason: result.reason,
        parserError: result.parserError,
        diagnostic: result.diagnostic,
      });

      if (result.importedCount > 0) {
        toast.success(`Importação concluída: ${result.importedCount} voo(s) salvo(s).`);
      } else if (result.parserError) {
        toast.error(`Parser falhou: ${result.parserError}`);
      } else {
        toast.info(result.reason ?? 'Sincronização executada sem novos voos para inserir.');
      }
    } catch (error) {
      if (isGmailScopeError(error)) {
        toast.error('Permissão Gmail ausente. Refaça o login com Google para liberar leitura de e-mail.');
      } else {
        const exactMessage = error instanceof Error ? error.message : 'Falha ao buscar CrewRosterReport no Gmail.';
        toast.error(exactMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [user, session]);

  const diagnosticJson = useMemo(() => {
    if (!syncState) return '';
    return JSON.stringify(syncState.diagnostic, null, 2);
  }, [syncState]);

  return (
    <AppLayout>
      <div className="max-w-4xl">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Importar escala IFlight</h1>
        <p className="text-muted-foreground mt-2">
          Busca tolerante no Gmail: <strong>has:attachment filename:pdf newer_than:180d</strong>, com filtro por assunto
          <strong> CrewRosterReport</strong> e remetente <strong>iFlight</strong>.
        </p>

        <div className="mt-6 bg-card border border-border rounded-xl p-6 shadow-card">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-5 h-5 text-primary" />
            <p className="font-medium text-foreground">Teste manual do importador /iflight-import</p>
          </div>

          <Button onClick={() => void runSync()} disabled={loading} className="gradient-sky text-primary-foreground">
            <DownloadCloud className="w-4 h-4 mr-2" />
            {loading ? 'Sincronizando...' : 'Executar importação agora'}
          </Button>

          {syncState && (
            <div className="mt-4 rounded-lg bg-muted p-4 text-sm text-foreground space-y-2">
              <p>Voos importados: <strong>{syncState.importedCount}</strong></p>
              <p>Voos detectados no parser: <strong>{syncState.parsedCount}</strong></p>
              {syncState.reason && <p className="text-muted-foreground">Motivo: {syncState.reason}</p>}
              {syncState.parserError && <p className="text-destructive">Erro exato do parser: {syncState.parserError}</p>}

              <div className="pt-2">
                <p className="font-medium">Resultado JSON completo:</p>
                <pre className="mt-2 rounded-md bg-background border border-border p-3 text-xs overflow-x-auto whitespace-pre-wrap break-words">
                  {diagnosticJson}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
