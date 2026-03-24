import { Link } from 'react-router-dom';
import { CalendarCheck, FileText, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserRosterConnection } from '@/hooks/useUserRosterConnection';
import { useActiveRosterDownload } from '@/hooks/useActiveRosterDownload';
import { formatDateTimeBR } from '@/lib/date-utils';
import { ROSTER_UX_MESSAGES } from '@/lib/roster/roster-ux-messages';
import { ConnectedRosterAutoUpdateService } from '@/modules/roster/services/ConnectedRosterAutoUpdateService';
import { useAuth } from '@/lib/auth-context';
import { useState } from 'react';
import { toast } from 'sonner';

export function RosterConnectionBanner() {
  const { user } = useAuth();
  const { activeRosterMeta, loading, refresh: refreshConnection } = useUserRosterConnection();
  const { downloading, downloadCurrent } = useActiveRosterDownload();
  const [checking, setChecking] = useState(false);

  if (loading || !user) return null;

  if (!activeRosterMeta) return null;

  const lastTs = activeRosterMeta?.synced_at ?? activeRosterMeta?.updated_at;

  const handleRefresh = async () => {
    if (!user) return;
    setChecking(true);
    toast.message(ROSTER_UX_MESSAGES.checkingUpdate);
    await ConnectedRosterAutoUpdateService.runLightUpdateCheck(user.id, { force: true });
    await refreshConnection();
    toast.success(ROSTER_UX_MESSAGES.scaleAlreadyUpToDate);
    setChecking(false);
  };

  return (
    <div className="mb-6 rounded-2xl border border-primary/20 bg-card/80 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ring-1 ring-primary/10">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
          <CalendarCheck className="w-5 h-5 text-success" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground text-sm">
            {ROSTER_UX_MESSAGES.scaleConnected}
            <span className="ml-2 text-xs font-semibold text-primary">(escala ativa no app)</span>
            {activeRosterMeta?.is_official_crew_roster_pdf ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">PDF oficial</span>
            ) : null}
          </p>
          {activeRosterMeta?.file_name && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="text-foreground/90 font-medium">{ROSTER_UX_MESSAGES.activeFileLabel}:</span>
              <span className="truncate">{activeRosterMeta.file_name}</span>
            </p>
          )}
          {lastTs && (
            <p className="text-xs text-muted-foreground mt-1">
              {ROSTER_UX_MESSAGES.lastUpdatedAt(formatDateTimeBR(lastTs))}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={downloading}
          onClick={() => void downloadCurrent()}
          className="gap-1.5"
        >
          <Download className={`w-4 h-4 ${downloading ? 'opacity-50' : ''}`} />
          Baixar escala atual
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={checking}
          onClick={handleRefresh}
          className="gap-1.5"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
          Atualizar escala
        </Button>
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link to="/download-roster">Conectar escala</Link>
        </Button>
      </div>
    </div>
  );
}
