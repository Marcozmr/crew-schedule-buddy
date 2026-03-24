import { useCallback, useEffect, useState } from 'react';
import { History, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import type { PdfImportResult } from '@/lib/pdf-import';
import {
  importFromStoredOfficialRow,
  importLatestOfficialCrewRosterFromStorage,
  listRecentOfficialCrewRosterImports,
  type RecentOfficialImportRow,
} from '@/modules/roster/services/OfficialCrewRosterQuickImportService';
import { ROSTER_UX_MESSAGES } from '@/lib/roster/roster-ux-messages';
import { emitRosterUpdated } from '@/lib/events/roster-events';
import { toast } from 'sonner';

interface CrewRosterQuickImportControlsProps {
  onImportDone?: () => void;
  /** Mostrar lista expansível dos últimos oficiais */
  showRecentList?: boolean;
  className?: string;
}

export function CrewRosterQuickImportControls({
  onImportDone,
  showRecentList = true,
  className,
}: CrewRosterQuickImportControlsProps) {
  const { user } = useAuth();
  const [recent, setRecent] = useState<RecentOfficialImportRow[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const refreshRecent = useCallback(async () => {
    if (!user) return;
    const rows = await listRecentOfficialCrewRosterImports(user.id, 8);
    setRecent(rows);
  }, [user]);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  const runImport = useCallback(
    async (fn: () => Promise<PdfImportResult>) => {
      if (!user) return;
      setLoading('run');
      const res = await fn();
      setLoading(null);
      if (res.duplicate) {
        toast.info(ROSTER_UX_MESSAGES.scaleAlreadyImported);
        onImportDone?.();
        return;
      }
      if (res.success && res.insertedCount > 0) {
        const replaced = (res.debug?.deactivatedRosterIds?.length ?? 0) > 0;
        if (replaced) {
          toast.success(ROSTER_UX_MESSAGES.newCrewRosterDetected, {
            description: ROSTER_UX_MESSAGES.previousReplaced,
          });
        } else {
          toast.success(ROSTER_UX_MESSAGES.scaleUpdatedSuccess);
        }
        emitRosterUpdated({
          userId: user.id,
          reason: replaced ? 'roster_replaced' : 'official_pdf_import',
          at: new Date().toISOString(),
        });
        void refreshRecent();
        onImportDone?.();
      } else if (res.error) {
        toast.error(res.error);
      }
    },
    [user, onImportDone, refreshRecent]
  );

  const handleUseLast = () => runImport(() => importLatestOfficialCrewRosterFromStorage(user!.id));

  const handleReuseRow = (id: string) => {
    if (!user) return;
    setLoading(id);
    void importFromStoredOfficialRow(user.id, id).then((res) => {
      setLoading(null);
      if (res.duplicate) {
        toast.info(ROSTER_UX_MESSAGES.scaleAlreadyImported);
        onImportDone?.();
        return;
      }
      if (res.success && res.insertedCount > 0) {
        const replaced = (res.debug?.deactivatedRosterIds?.length ?? 0) > 0;
        if (replaced) {
          toast.success(ROSTER_UX_MESSAGES.newCrewRosterDetected, {
            description: ROSTER_UX_MESSAGES.previousReplaced,
          });
        } else {
          toast.success(ROSTER_UX_MESSAGES.scaleUpdatedSuccess);
        }
        emitRosterUpdated({
          userId: user.id,
          reason: replaced ? 'roster_replaced' : 'official_pdf_import',
          at: new Date().toISOString(),
        });
        void refreshRecent();
        onImportDone?.();
      } else if (res.error) {
        toast.error(res.error);
      }
    });
  };

  if (!user) return null;

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2 items-center">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          disabled={loading !== null || recent.length === 0}
          onClick={() => void handleUseLast()}
        >
          {loading === 'run' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Usar último CrewRosterReport
        </Button>
      </div>

      {showRecentList && recent.length > 0 && (
        <div className="mt-3 rounded-lg border border-border/80 bg-muted/20 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <History className="w-3.5 h-3.5" />
            Últimos CrewRosterReport no armazenamento
          </div>
          <ul className="space-y-2 max-h-48 overflow-y-auto text-left">
            {recent.map((r) => (
              <li
                key={r.id}
                className="rounded-md bg-background/80 px-2 py-2 border border-border/60 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium text-foreground break-all" title={r.file_name}>
                    {r.file_name}
                  </span>
                  {r.is_active ? (
                    <span className="text-[10px] font-bold uppercase text-primary shrink-0">ATIVA</span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleString('pt-BR')}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] px-2"
                    disabled={loading !== null}
                    onClick={() => handleReuseRow(r.id)}
                  >
                    {loading === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Reimportar'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
