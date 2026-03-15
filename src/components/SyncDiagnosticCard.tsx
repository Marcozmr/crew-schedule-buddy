import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { importScheduleFromGmail, isGmailScopeError, type ImportDiagnostic } from '@/lib/gmail-import';
import { Wifi, WifiOff, Mail, FileText, CheckCircle2, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const PROVIDER_TOKEN_KEY = 'google_provider_token';

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

interface SyncResult {
  importedCount: number;
  parsedCount: number;
  reason?: string;
  parserError?: string;
  diagnostic: ImportDiagnostic;
}

interface SyncDiagnosticCardProps {
  onSyncComplete?: () => void;
  lastSyncTime?: string | null;
}

function StatusDot({ ok }: { ok: boolean | null }) {
  if (ok === null) return <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />;
  return ok
    ? <CheckCircle2 className="w-4 h-4 text-success" />
    : <XCircle className="w-4 h-4 text-destructive" />;
}

export function SyncDiagnosticCard({ onSyncComplete, lastSyncTime }: SyncDiagnosticCardProps) {
  const { user, session } = useAuth();
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [result, setResult] = useState<SyncResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);

  const hasToken = Boolean(
    (session as { provider_token?: string | null } | null)?.provider_token ??
    localStorage.getItem(PROVIDER_TOKEN_KEY)
  );

  const runSync = useCallback(async () => {
    if (!user) return;

    const tokenFromSession = (session as { provider_token?: string | null } | null)?.provider_token ?? null;
    if (tokenFromSession) localStorage.setItem(PROVIDER_TOKEN_KEY, tokenFromSession);
    const providerToken = tokenFromSession ?? localStorage.getItem(PROVIDER_TOKEN_KEY);

    if (!providerToken) {
      toast.error('Token do Google ausente. Faça logout e login novamente.');
      return;
    }

    setStatus('syncing');
    setErrorMsg(null);
    setResult(null);

    try {
      const res = await importScheduleFromGmail(user.id, providerToken, {
        searchQuery: 'has:attachment filename:pdf newer_than:180d',
        subjectContains: 'CrewRosterReport',
        senderContains: 'iFlight',
      });

      setResult(res);

      if (res.importedCount > 0) {
        setStatus('success');
        toast.success(`${res.importedCount} voo(s) importado(s) com sucesso!`);
      } else if (res.parserError) {
        setStatus('error');
        setErrorMsg(res.parserError);
        toast.error(`Parser falhou: ${res.parserError}`);
      } else {
        setStatus('success');
        toast.info(res.reason ?? 'Nenhum voo novo encontrado.');
      }

      onSyncComplete?.();
    } catch (error) {
      setStatus('error');
      if (isGmailScopeError(error)) {
        setErrorMsg('Permissão Gmail ausente. Refaça login com Google.');
        toast.error('Permissão Gmail ausente.');
      } else {
        const msg = error instanceof Error ? error.message : 'Falha na importação.';
        setErrorMsg(msg);
        toast.error(msg);
      }
    }
  }, [user, session, onSyncComplete]);

  const diag = result?.diagnostic;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-5 shadow-card"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {hasToken ? <Wifi className="w-5 h-5 text-success" /> : <WifiOff className="w-5 h-5 text-destructive" />}
          <h3 className="font-semibold text-foreground">Sincronização Gmail</h3>
        </div>
        <Button
          onClick={() => void runSync()}
          disabled={status === 'syncing'}
          size="sm"
          className="gradient-sky text-primary-foreground"
        >
          <RefreshCw className={`w-4 h-4 mr-1.5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
          {status === 'syncing' ? 'Sincronizando...' : 'Sincronizar agora'}
        </Button>
      </div>

      {/* Status pipeline */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
        <div className="flex items-center gap-2 bg-muted rounded-lg p-2.5">
          <StatusDot ok={diag ? hasToken : null} />
          <span className="text-muted-foreground">Gmail conectado</span>
        </div>
        <div className="flex items-center gap-2 bg-muted rounded-lg p-2.5">
          <StatusDot ok={diag ? diag.email_encontrado : null} />
          <span className="text-muted-foreground">Email encontrado</span>
        </div>
        <div className="flex items-center gap-2 bg-muted rounded-lg p-2.5">
          <StatusDot ok={diag ? diag.pdf_baixado : null} />
          <span className="text-muted-foreground">PDF baixado</span>
        </div>
        <div className="flex items-center gap-2 bg-muted rounded-lg p-2.5">
          <StatusDot ok={diag ? diag.pdf_parseado : null} />
          <span className="text-muted-foreground">Parser OK</span>
        </div>
        <div className="flex items-center gap-2 bg-muted rounded-lg p-2.5">
          <StatusDot ok={diag ? diag.voos_salvos : null} />
          <span className="text-muted-foreground">Voos salvos</span>
        </div>
      </div>

      {/* Sync result summary */}
      {result && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-muted-foreground">Emails: <strong className="text-foreground">{diag?.emails_found ?? 0}</strong></span>
            <span className="text-muted-foreground">Voos detectados: <strong className="text-foreground">{result.parsedCount}</strong></span>
            <span className="text-muted-foreground">Novos importados: <strong className="text-foreground">{result.importedCount}</strong></span>
          </div>

          {result.reason && !result.parserError && (
            <p className="text-xs text-muted-foreground">{result.reason}</p>
          )}
        </div>
      )}

      {/* Error display */}
      {errorMsg && (
        <div className="mt-3 flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Last sync */}
      {lastSyncTime && (
        <p className="mt-2 text-[10px] text-muted-foreground">Última sincronização: {lastSyncTime}</p>
      )}

      {/* JSON toggle */}
      {diag && (
        <div className="mt-3">
          <button
            onClick={() => setShowJson(!showJson)}
            className="text-xs text-primary hover:underline"
          >
            {showJson ? 'Ocultar diagnóstico JSON' : 'Ver diagnóstico completo (JSON)'}
          </button>
          {showJson && (
            <pre className="mt-2 rounded-md bg-background border border-border p-3 text-[10px] overflow-x-auto whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
              {JSON.stringify(diag, null, 2)}
            </pre>
          )}
        </div>
      )}
    </motion.div>
  );
}
