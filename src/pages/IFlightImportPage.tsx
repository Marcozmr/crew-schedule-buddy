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
  parserError?: string;
  debug: {
    emailCount: number;
    subjects: string[];
    pdfAttachments: Array<{
      messageId: string;
      filename: string;
      attachmentId: string;
    }>;
    selectedAttachmentId: string | null;
    downloadSucceeded: boolean;
  };
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
        debug: result.debug,
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

  return (
    <AppLayout>
      <div className="max-w-4xl">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Importar escala IFlight</h1>
        <p className="text-muted-foreground mt-2">
          Esta rota busca no Gmail com <strong>has:attachment filename:pdf newer_than:180d</strong>, filtra por assunto contendo
          <strong> CrewRosterReport</strong> e remetente contendo <strong>iFlight</strong>.
        </p>

        <div className="mt-6 bg-card border border-border rounded-xl p-6 shadow-card">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-5 h-5 text-primary" />
            <p className="font-medium text-foreground">Trigger manual do importador /iflight-import</p>
          </div>

          <Button onClick={() => void runSync()} disabled={loading} className="gradient-sky text-primary-foreground">
            <DownloadCloud className="w-4 h-4 mr-2" />
            {loading ? 'Sincronizando...' : 'Executar importação agora'}
          </Button>

          {syncState && (
            <div className="mt-4 rounded-lg bg-muted p-4 text-sm text-foreground space-y-2">
              <p>Voos importados: <strong>{syncState.importedCount}</strong></p>
              <p>Voos detectados no parser: <strong>{syncState.parsedCount}</strong></p>
              <p>E-mails encontrados na busca: <strong>{syncState.debug.emailCount}</strong></p>
              <p>Attachment selecionado: <strong>{syncState.debug.selectedAttachmentId ?? 'Nenhum'}</strong></p>
              <p>Download do anexo: <strong>{syncState.debug.downloadSucceeded ? 'ok' : 'falhou'}</strong></p>

              {syncState.reason && <p className="text-muted-foreground">Motivo: {syncState.reason}</p>}
              {syncState.parserError && <p className="text-destructive">Erro exato do parser: {syncState.parserError}</p>}

              <div className="pt-2">
                <p className="font-medium">Subjects encontrados:</p>
                {syncState.debug.subjects.length > 0 ? (
                  <ul className="list-disc list-inside text-muted-foreground">
                    {syncState.debug.subjects.map((subject, index) => (
                      <li key={`${subject}-${index}`}>{subject}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">Nenhum subject listado.</p>
                )}
              </div>

              <div className="pt-2">
                <p className="font-medium">Anexos PDF encontrados:</p>
                {syncState.debug.pdfAttachments.length > 0 ? (
                  <ul className="list-disc list-inside text-muted-foreground">
                    {syncState.debug.pdfAttachments.map((attachment, index) => (
                      <li key={`${attachment.messageId}-${attachment.attachmentId}-${index}`}>
                        {attachment.filename} • attachmentId: {attachment.attachmentId}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">Nenhum anexo PDF listado.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
