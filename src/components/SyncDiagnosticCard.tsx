import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { importScheduleFromGmail, isGmailScopeError, type ImportDiagnostic } from '@/lib/gmail-import';
import { supabase } from '@/integrations/supabase/client';
import { Wifi, WifiOff, CheckCircle2, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const PROVIDER_TOKEN_KEY = 'google_provider_token';
const LAST_SYNC_KEY_PREFIX = 'iflight_last_sync_snapshot_';

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

type ScheduleRowPreview = {
  user_id: string;
  duty_date: string;
  duty_type: string;
  flight_number: string;
  departure_airport: string;
  arrival_airport: string;
};

type SyncSnapshot = {
  user_id: string;
  email: string;
  gmail_scope_ok: boolean;
  emails_found: number;
  matched_email_subjects: string[];
  attachments_found: Array<{ name: string; mimeType: string; attachmentId: string }>;
  selected_attachment_name: string | null;
  attachment_download_ok: boolean;
  pdf_saved_ok: boolean;
  parser_ok: boolean;
  parsed_flights_count: number;
  inserted_rows_count: number;
  total_rows_in_schedule_entries_for_current_user: number;
  latest_imported_duty_date: string | null;
  latest_import_error: string | null;
  last_sync_at: string;
  schedule_entries_preview: ScheduleRowPreview[];
};

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

function emptyDiagnostic(authenticated: boolean): ImportDiagnostic {
  return {
    authenticated,
    gmail_scope_ok: false,
    emails_found: 0,
    matched_email_subjects: [],
    attachments_found: [],
    selected_attachment_name: null,
    attachment_download_ok: false,
    pdf_saved_ok: false,
    parser_ok: false,
    parsed_flights_count: 0,
    parsed_entries_preview: [],
    db_insert_ok: false,
    inserted_rows_count: 0,
    final_error: null,
    email_encontrado: false,
    pdf_baixado: false,
    pdf_parseado: false,
    voos_salvos: false,
    dashboard_atualizado: false,
    parser_failure_log_path: null,
  };
}

export function SyncDiagnosticCard({ onSyncComplete, lastSyncTime }: SyncDiagnosticCardProps) {
  const { user, session, profile } = useAuth();
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [result, setResult] = useState<ImportDiagnostic | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [snapshot, setSnapshot] = useState<SyncSnapshot | null>(null);

  const hasToken = Boolean(
    (session as { provider_token?: string | null } | null)?.provider_token ??
    localStorage.getItem(PROVIDER_TOKEN_KEY)
  );

  const snapshotStorageKey = useMemo(
    () => (user ? `${LAST_SYNC_KEY_PREFIX}${user.id}` : null),
    [user]
  );

  const fetchUserScheduleSnapshot = useCallback(async (userId: string) => {
    const [{ data: countData }, { data: previewData }] = await Promise.all([
      supabase
        .from('schedule_entries')
        .select('date', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('schedule_entries')
        .select('user_id, date, status, flight_number, departure, arrival')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const totalRows = countData ?? 0;

    const { data: latestDateData } = await supabase
      .from('schedule_entries')
      .select('date')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const schedulePreview: ScheduleRowPreview[] = (previewData ?? []).map((row) => ({
      user_id: row.user_id,
      duty_date: row.date,
      duty_type: row.status,
      flight_number: row.flight_number,
      departure_airport: row.departure,
      arrival_airport: row.arrival,
    }));

    return {
      totalRows,
      latestDutyDate: latestDateData?.date ?? null,
      schedulePreview,
    };
  }, []);

  useEffect(() => {
    if (!snapshotStorageKey) return;
    const raw = localStorage.getItem(snapshotStorageKey);
    if (!raw) return;
    try {
      setSnapshot(JSON.parse(raw) as SyncSnapshot);
    } catch {
      localStorage.removeItem(snapshotStorageKey);
    }
  }, [snapshotStorageKey]);

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

    try {
      const res = await importScheduleFromGmail(user.id, providerToken, {
        searchQuery: 'has:attachment filename:pdf newer_than:180d',
        subjectContains: 'CrewRosterReport',
        senderContains: 'iFlight',
      });

      const latestError = res.diagnostic.final_error ?? res.parserError ?? res.reason ?? null;
      const scheduleSnapshot = await fetchUserScheduleSnapshot(user.id);
      const nowIso = new Date().toISOString();

      const nextSnapshot: SyncSnapshot = {
        user_id: user.id,
        email: profile?.email ?? user.email ?? '',
        gmail_scope_ok: res.diagnostic.gmail_scope_ok,
        emails_found: res.diagnostic.emails_found,
        matched_email_subjects: res.diagnostic.matched_email_subjects,
        attachments_found: res.diagnostic.attachments_found.map((item) => ({
          name: item.name,
          mimeType: item.mimeType,
          attachmentId: item.attachmentId,
        })),
        selected_attachment_name: res.diagnostic.selected_attachment_name,
        attachment_download_ok: res.diagnostic.attachment_download_ok,
        pdf_saved_ok: res.diagnostic.pdf_saved_ok,
        parser_ok: res.diagnostic.parser_ok,
        parsed_flights_count: res.diagnostic.parsed_flights_count,
        inserted_rows_count: res.diagnostic.inserted_rows_count,
        total_rows_in_schedule_entries_for_current_user: scheduleSnapshot.totalRows,
        latest_imported_duty_date: scheduleSnapshot.latestDutyDate,
        latest_import_error: latestError,
        last_sync_at: nowIso,
        schedule_entries_preview: scheduleSnapshot.schedulePreview,
      };

      if (snapshotStorageKey) {
        localStorage.setItem(snapshotStorageKey, JSON.stringify(nextSnapshot));
      }

      setSnapshot(nextSnapshot);
      setResult(res.diagnostic);

      if (res.importedCount > 0) {
        setStatus('success');
        toast.success(`${res.importedCount} voo(s) importado(s) com sucesso!`);
      } else if (res.parserError || res.diagnostic.final_error) {
        setStatus('error');
        setErrorMsg(res.parserError ?? res.diagnostic.final_error ?? 'Falha na importação.');
        toast.error(res.parserError ?? res.diagnostic.final_error ?? 'Falha na importação.');
      } else {
        setStatus('success');
        toast.info(res.reason ?? 'Nenhum voo novo encontrado.');
      }

      onSyncComplete?.();
    } catch (error) {
      setStatus('error');
      const diagnosticFallback = emptyDiagnostic(Boolean(user));
      const exactError = isGmailScopeError(error)
        ? 'Permissão Gmail ausente. Refaça login com Google.'
        : error instanceof Error
          ? error.message
          : 'Falha na importação.';
      setErrorMsg(exactError);
      toast.error(exactError);

      const scheduleSnapshot = await fetchUserScheduleSnapshot(user.id);
      const nowIso = new Date().toISOString();
      const nextSnapshot: SyncSnapshot = {
        user_id: user.id,
        email: profile?.email ?? user.email ?? '',
        gmail_scope_ok: false,
        emails_found: 0,
        matched_email_subjects: [],
        attachments_found: [],
        selected_attachment_name: null,
        attachment_download_ok: false,
        pdf_saved_ok: false,
        parser_ok: false,
        parsed_flights_count: 0,
        inserted_rows_count: 0,
        total_rows_in_schedule_entries_for_current_user: scheduleSnapshot.totalRows,
        latest_imported_duty_date: scheduleSnapshot.latestDutyDate,
        latest_import_error: exactError,
        last_sync_at: nowIso,
        schedule_entries_preview: scheduleSnapshot.schedulePreview,
      };

      if (snapshotStorageKey) localStorage.setItem(snapshotStorageKey, JSON.stringify(nextSnapshot));
      setSnapshot(nextSnapshot);
      setResult(diagnosticFallback);
    }
  }, [user, session, profile, onSyncComplete, fetchUserScheduleSnapshot, snapshotStorageKey]);

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

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs mb-4">
        <div className="flex items-center gap-2 bg-muted rounded-lg p-2.5">
          <StatusDot ok={result ? hasToken : null} />
          <span className="text-muted-foreground">Gmail conectado</span>
        </div>
        <div className="flex items-center gap-2 bg-muted rounded-lg p-2.5">
          <StatusDot ok={result ? result.email_encontrado : null} />
          <span className="text-muted-foreground">Email encontrado</span>
        </div>
        <div className="flex items-center gap-2 bg-muted rounded-lg p-2.5">
          <StatusDot ok={result ? result.pdf_baixado : null} />
          <span className="text-muted-foreground">PDF baixado</span>
        </div>
        <div className="flex items-center gap-2 bg-muted rounded-lg p-2.5">
          <StatusDot ok={result ? result.pdf_parseado : null} />
          <span className="text-muted-foreground">Parser OK</span>
        </div>
        <div className="flex items-center gap-2 bg-muted rounded-lg p-2.5">
          <StatusDot ok={result ? result.voos_salvos : null} />
          <span className="text-muted-foreground">Voos salvos</span>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-3 flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {snapshot && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-xs font-semibold text-foreground mb-2">Última execução (valores reais)</p>
            <pre className="text-[11px] text-foreground whitespace-pre-wrap break-words">{JSON.stringify({
              user_id: snapshot.user_id,
              email: snapshot.email,
              gmail_scope_ok: snapshot.gmail_scope_ok,
              emails_found: snapshot.emails_found,
              matched_email_subjects: snapshot.matched_email_subjects,
              attachments_found: snapshot.attachments_found,
              selected_attachment_name: snapshot.selected_attachment_name,
              attachment_download_ok: snapshot.attachment_download_ok,
              pdf_saved_ok: snapshot.pdf_saved_ok,
              parser_ok: snapshot.parser_ok,
              parsed_flights_count: snapshot.parsed_flights_count,
              inserted_rows_count: snapshot.inserted_rows_count,
              total_rows_in_schedule_entries_for_current_user: snapshot.total_rows_in_schedule_entries_for_current_user,
              latest_imported_duty_date: snapshot.latest_imported_duty_date,
              latest_import_error: snapshot.latest_import_error,
              last_sync_at: snapshot.last_sync_at,
            }, null, 2)}</pre>
          </div>

          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-xs font-semibold text-foreground mb-2">5 registros reais de schedule_entries</p>
            <pre className="text-[11px] text-foreground whitespace-pre-wrap break-words">{JSON.stringify(snapshot.schedule_entries_preview, null, 2)}</pre>
          </div>
        </div>
      )}

      {(lastSyncTime || snapshot?.last_sync_at) && (
        <p className="mt-3 text-[10px] text-muted-foreground">
          Última sincronização: {snapshot?.last_sync_at ?? lastSyncTime}
        </p>
      )}

      {result && (
        <div className="mt-3">
          <button onClick={() => setShowJson(!showJson)} className="text-xs text-primary hover:underline">
            {showJson ? 'Ocultar diagnóstico técnico' : 'Ver diagnóstico técnico'}
          </button>
          {showJson && (
            <pre className="mt-2 rounded-md bg-background border border-border p-3 text-[10px] overflow-x-auto whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </motion.div>
  );
}
