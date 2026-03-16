import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { importScheduleFromGmail, isGmailScopeError, type ImportDiagnostic } from '@/lib/gmail-import';
import { supabase } from '@/integrations/supabase/client';
import { Wifi, WifiOff, CheckCircle2, XCircle, RefreshCw, AlertTriangle, LogOut } from 'lucide-react';
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

type ScheduleCompareRow = {
  user_id: string;
  date: string;
  flight_number: string;
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
  schedule_entries_compare_preview: ScheduleCompareRow[];
  // new diagnostic fields
  access_token_present: boolean;
  provider_token_present: boolean;
  provider_token_source: string;
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

export function SyncDiagnosticCard({ onSyncComplete, lastSyncTime }: SyncDiagnosticCardProps) {
  const { user, session, profile, providerToken, signOut } = useAuth();
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [result, setResult] = useState<ImportDiagnostic | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [snapshot, setSnapshot] = useState<SyncSnapshot | null>(null);

  const sessionProviderToken = (session as { provider_token?: string | null } | null)?.provider_token ?? null;
  const effectiveToken = providerToken ?? sessionProviderToken ?? localStorage.getItem(PROVIDER_TOKEN_KEY);
  const hasToken = Boolean(effectiveToken);

  const tokenSource = useMemo(() => {
    if (sessionProviderToken) return 'session';
    if (providerToken && providerToken === localStorage.getItem(PROVIDER_TOKEN_KEY)) return 'localStorage';
    if (providerToken) return 'auth-context';
    if (localStorage.getItem(PROVIDER_TOKEN_KEY)) return 'localStorage';
    return 'none';
  }, [sessionProviderToken, providerToken]);

  const snapshotStorageKey = useMemo(
    () => (user ? `${LAST_SYNC_KEY_PREFIX}${user.id}` : null),
    [user]
  );

  const fetchUserScheduleSnapshot = useCallback(async (userId: string) => {
    const [{ count }, { data: previewData }, { data: latestDateData }, { data: compareData }] = await Promise.all([
      supabase
        .from('schedule_entries')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('schedule_entries')
        .select('user_id, date, status, flight_number, departure, arrival')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('schedule_entries')
        .select('date')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('schedule_entries')
        .select('user_id, date, flight_number')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const totalRows = count ?? 0;

    const schedulePreview: ScheduleRowPreview[] = (previewData ?? []).map((row) => ({
      user_id: row.user_id,
      duty_date: row.date,
      duty_type: row.status,
      flight_number: row.flight_number,
      departure_airport: row.departure,
      arrival_airport: row.arrival,
    }));

    const comparePreview: ScheduleCompareRow[] = totalRows === 0
      ? (compareData ?? []).map((row) => ({
          user_id: row.user_id,
          date: row.date,
          flight_number: row.flight_number,
        }))
      : [];

    return {
      totalRows,
      latestDutyDate: latestDateData?.date ?? null,
      schedulePreview,
      comparePreview,
    };
  }, []);

  // Load previous snapshot
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

  // Bootstrap snapshot on first render
  useEffect(() => {
    if (!user || snapshot) return;
    const bootstrap = async () => {
      const sched = await fetchUserScheduleSnapshot(user.id);
      setSnapshot({
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
        total_rows_in_schedule_entries_for_current_user: sched.totalRows,
        latest_imported_duty_date: sched.latestDutyDate,
        latest_import_error: 'Nenhuma execução registrada ainda. Clique em Sincronizar agora.',
        last_sync_at: lastSyncTime ?? '',
        schedule_entries_preview: sched.schedulePreview,
        access_token_present: Boolean(session?.access_token),
        provider_token_present: hasToken,
        provider_token_source: tokenSource,
      });
    };
    void bootstrap();
  }, [user, profile, snapshot, fetchUserScheduleSnapshot, lastSyncTime, session, hasToken, tokenSource]);

  const buildSnapshot = useCallback(async (
    userId: string,
    diag: ImportDiagnostic | null,
    error: string | null,
  ): Promise<SyncSnapshot> => {
    const sched = await fetchUserScheduleSnapshot(userId);
    const nowIso = new Date().toISOString();
    return {
      user_id: userId,
      email: profile?.email ?? user?.email ?? '',
      gmail_scope_ok: diag?.gmail_scope_ok ?? false,
      emails_found: diag?.emails_found ?? 0,
      matched_email_subjects: diag?.matched_email_subjects ?? [],
      attachments_found: (diag?.attachments_found ?? []).map((a) => ({
        name: a.name, mimeType: a.mimeType, attachmentId: a.attachmentId,
      })),
      selected_attachment_name: diag?.selected_attachment_name ?? null,
      attachment_download_ok: diag?.attachment_download_ok ?? false,
      pdf_saved_ok: diag?.pdf_saved_ok ?? false,
      parser_ok: diag?.parser_ok ?? false,
      parsed_flights_count: diag?.parsed_flights_count ?? 0,
      inserted_rows_count: diag?.inserted_rows_count ?? 0,
      total_rows_in_schedule_entries_for_current_user: sched.totalRows,
      latest_imported_duty_date: sched.latestDutyDate,
      latest_import_error: error,
      last_sync_at: nowIso,
      schedule_entries_preview: sched.schedulePreview,
      access_token_present: Boolean(session?.access_token),
      provider_token_present: hasToken,
      provider_token_source: tokenSource,
    };
  }, [fetchUserScheduleSnapshot, profile, user, session, hasToken, tokenSource]);

  const runSync = useCallback(async () => {
    if (!user) return;

    if (!effectiveToken) {
      toast.error('Token do Google ausente. Faça logout e login novamente para conceder acesso ao Gmail.');
      setErrorMsg('provider_token ausente. Faça logout → login novamente.');
      return;
    }

    setStatus('syncing');
    setErrorMsg(null);

    try {
      const res = await importScheduleFromGmail(user.id, effectiveToken, {
        searchQuery: 'has:attachment filename:pdf newer_than:180d',
        subjectContains: 'CrewRosterReport',
        senderContains: 'iFlight',
      });

      const latestError = res.diagnostic.final_error ?? res.parserError ?? null;
      const snap = await buildSnapshot(user.id, res.diagnostic, latestError);

      if (snapshotStorageKey) localStorage.setItem(snapshotStorageKey, JSON.stringify(snap));
      setSnapshot(snap);
      setResult(res.diagnostic);

      if (res.importedCount > 0) {
        setStatus('success');
        toast.success(`${res.importedCount} voo(s) importado(s)!`);
      } else if (res.parserError || res.diagnostic.final_error) {
        setStatus('error');
        setErrorMsg(res.parserError ?? res.diagnostic.final_error ?? 'Falha.');
      } else {
        setStatus('success');
        toast.info(res.reason ?? 'Sem voos novos.');
      }

      onSyncComplete?.();
    } catch (error) {
      setStatus('error');
      const exactError = isGmailScopeError(error)
        ? 'Permissão Gmail ausente (401/403). Faça logout e login novamente com Google concedendo acesso ao Gmail.'
        : error instanceof Error ? error.message : 'Falha.';
      setErrorMsg(exactError);
      toast.error(exactError);

      const snap = await buildSnapshot(user.id, null, exactError);
      if (snapshotStorageKey) localStorage.setItem(snapshotStorageKey, JSON.stringify(snap));
      setSnapshot(snap);
    }
  }, [user, effectiveToken, onSyncComplete, buildSnapshot, snapshotStorageKey]);

  const handleReauth = useCallback(async () => {
    await signOut();
    toast.info('Sessão encerrada. Entre novamente com Google para conceder acesso ao Gmail.');
  }, [signOut]);

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
        <div className="flex gap-2">
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
      </div>

      {/* No provider token warning */}
      {!hasToken && user && (
        <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 space-y-2">
          <p className="text-sm text-yellow-600 font-medium">
            ⚠️ Seu login foi feito sem permissão Gmail. Entre novamente e conceda acesso ao Gmail para importar sua escala.
          </p>
          <Button onClick={() => void handleReauth()} size="sm" variant="outline" className="text-yellow-700 border-yellow-500/50">
            <LogOut className="w-4 h-4 mr-1.5" />
            Sair e reconectar com Gmail
          </Button>
        </div>
      )}

      {/* Status pipeline */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs mb-3">
        <div className="flex items-center gap-2 bg-muted rounded-lg p-2.5">
          <StatusDot ok={snapshot ? hasToken : null} />
          <span className="text-muted-foreground">Gmail conectado</span>
        </div>
        <div className="flex items-center gap-2 bg-muted rounded-lg p-2.5">
          <StatusDot ok={snapshot ? snapshot.gmail_scope_ok : null} />
          <span className="text-muted-foreground">gmail_scope_ok</span>
        </div>
        <div className="flex items-center gap-2 bg-muted rounded-lg p-2.5">
          <StatusDot ok={snapshot ? snapshot.pdf_saved_ok : null} />
          <span className="text-muted-foreground">PDF baixado</span>
        </div>
        <div className="flex items-center gap-2 bg-muted rounded-lg p-2.5">
          <StatusDot ok={snapshot ? snapshot.parser_ok : null} />
          <span className="text-muted-foreground">Parser OK</span>
        </div>
        <div className="flex items-center gap-2 bg-muted rounded-lg p-2.5">
          <StatusDot ok={snapshot ? snapshot.inserted_rows_count > 0 : null} />
          <span className="text-muted-foreground">Voos salvos</span>
        </div>
      </div>

      {/* Token diagnostics */}
      <div className="grid grid-cols-3 gap-2 text-[11px] mb-3">
        <div className="bg-muted rounded-lg p-2">
          <span className="text-muted-foreground">access_token:</span>{' '}
          <strong className={session?.access_token ? 'text-success' : 'text-destructive'}>
            {session?.access_token ? 'presente' : 'ausente'}
          </strong>
        </div>
        <div className="bg-muted rounded-lg p-2">
          <span className="text-muted-foreground">provider_token:</span>{' '}
          <strong className={hasToken ? 'text-success' : 'text-destructive'}>
            {hasToken ? 'presente' : 'ausente'}
          </strong>
        </div>
        <div className="bg-muted rounded-lg p-2">
          <span className="text-muted-foreground">source:</span>{' '}
          <strong className="text-foreground">{tokenSource}</strong>
        </div>
      </div>

      {/* Error display */}
      {errorMsg && (
        <div className="mb-3 flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Full snapshot display */}
      {snapshot && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-xs font-semibold text-foreground mb-2">Última execução (valores reais)</p>
            <pre className="text-[11px] text-foreground whitespace-pre-wrap break-words max-h-72 overflow-y-auto">{JSON.stringify({
              user_id: snapshot.user_id,
              email: snapshot.email,
              gmail_scope_ok: snapshot.gmail_scope_ok,
              access_token_present: snapshot.access_token_present,
              provider_token_present: snapshot.provider_token_present,
              provider_token_source: snapshot.provider_token_source,
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

          {snapshot.schedule_entries_preview.length > 0 && (
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs font-semibold text-foreground mb-2">5 registros reais de schedule_entries</p>
              <pre className="text-[11px] text-foreground whitespace-pre-wrap break-words">{JSON.stringify(snapshot.schedule_entries_preview, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {(lastSyncTime || snapshot?.last_sync_at) && (
        <p className="mt-3 text-[10px] text-muted-foreground">
          Última sync: {snapshot?.last_sync_at ?? lastSyncTime}
        </p>
      )}

      {result && (
        <div className="mt-3">
          <button onClick={() => setShowJson(!showJson)} className="text-xs text-primary hover:underline">
            {showJson ? 'Ocultar diagnóstico técnico' : 'Ver diagnóstico técnico completo'}
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
