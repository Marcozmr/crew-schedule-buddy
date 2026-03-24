import { Link } from 'react-router-dom';
import { CalendarCheck, FileText, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PdfImportDialog } from '@/components/PdfImportDialog';
import { CrewRosterQuickImportControls } from '@/components/roster/CrewRosterQuickImportControls';
import { useUserRosterConnection } from '@/hooks/useUserRosterConnection';
import { useActiveRosterDownload } from '@/hooks/useActiveRosterDownload';
import { formatDateTimeBR } from '@/lib/date-utils';
import { ROSTER_UX_MESSAGES } from '@/lib/roster/roster-ux-messages';
import { getRosterBannerStatusLine } from '@/lib/roster/connection-ux';
import { ConnectedRosterAutoUpdateService } from '@/modules/roster/services/ConnectedRosterAutoUpdateService';
import { useAuth } from '@/lib/auth-context';

export function RosterConnectionBanner() {
  const { user } = useAuth();
  const { connection, activeRosterMeta, loading, refresh: refreshConnection } = useUserRosterConnection();
  const { downloading, downloadCurrent } = useActiveRosterDownload();

  if (loading || !user) return null;

  if (!activeRosterMeta) return null;

  const lastTs = activeRosterMeta?.synced_at ?? activeRosterMeta?.updated_at;
  const statusLine = getRosterBannerStatusLine(
    connection?.roster_connection_state,
    connection?.connection_status,
    true
  );

  const handleAfterImport = async () => {
    await ConnectedRosterAutoUpdateService.runLightUpdateCheck(user.id, { force: true });
    await refreshConnection();
  };

  return (
    <div
      className="mb-6 rounded-2xl border border-primary/25 bg-gradient-to-br from-card via-card to-primary/[0.06] px-4 py-4 sm:px-5 sm:py-5 shadow-md ring-1 ring-primary/10"
      role="region"
      aria-label="Escala conectada"
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-2xl bg-success/15 flex items-center justify-center shrink-0 ring-1 ring-success/20">
            <CalendarCheck className="w-5 h-5 text-success" />
          </div>
          <div className="min-w-0 space-y-2">
            <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
              {ROSTER_UX_MESSAGES.scaleConnectedBannerTitle}
            </h2>
            <p className="text-xs text-muted-foreground/95 leading-snug border-l-2 border-primary/30 pl-2.5">
              {ROSTER_UX_MESSAGES.scaleConnectedProductLine}
            </p>
            <p className="text-xs text-muted-foreground leading-snug">
              <span className="font-medium text-foreground/90">{ROSTER_UX_MESSAGES.connectionStatusField}:</span>{' '}
              {statusLine}
            </p>
            {activeRosterMeta?.file_name && (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary/80" />
                <span>
                  <span className="text-foreground/90 font-medium">{ROSTER_UX_MESSAGES.activeFileLabel}:</span>{' '}
                  <span className="break-all">{activeRosterMeta.file_name}</span>
                </span>
              </p>
            )}
            {lastTs && (
              <p className="text-xs text-muted-foreground">
                {ROSTER_UX_MESSAGES.lastUpdatedAt(formatDateTimeBR(lastTs))}
              </p>
            )}
            {activeRosterMeta?.is_official_crew_roster_pdf ? (
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground/90">CrewRosterReport oficial</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2 shrink-0 w-full lg:max-w-md lg:items-end">
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full lg:justify-end">
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={downloading}
              onClick={() => void downloadCurrent()}
              className="gap-1.5 w-full sm:w-auto min-h-[2.25rem]"
            >
              <Download className={`w-4 h-4 ${downloading ? 'opacity-50' : ''}`} />
              Baixar escala atual
            </Button>
            <PdfImportDialog
              onImportComplete={() => void handleAfterImport()}
              trigger={
                <Button type="button" variant="outline" size="sm" className="gap-1.5 w-full sm:w-auto min-h-[2.25rem]">
                  <RefreshCw className="w-4 h-4" />
                  Atualizar escala
                </Button>
              }
            />
            <Button type="button" variant="ghost" size="sm" className="w-full sm:w-auto text-muted-foreground" asChild>
              <Link to="/download-roster">Fontes e integrações</Link>
            </Button>
          </div>
          <div className="w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2">
            <p className="text-[11px] text-muted-foreground mb-1.5">Atalho — último PDF autorizado</p>
            <CrewRosterQuickImportControls
              showRecentList={false}
              onImportDone={() => void refreshConnection()}
              className="flex flex-wrap gap-2 justify-end"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
