/**
 * PWA instalado (Chrome/Edge): “Abrir com” / file_handlers entrega PDF ao app.
 * https://developer.chrome.com/docs/capabilities/pwa-file-handling
 */

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { importPdfFile } from '@/lib/pdf-import';
import { isOfficialCrewRosterFileName } from '@/lib/roster/official-crew-roster';
import { ROSTER_UX_MESSAGES } from '@/lib/roster/roster-ux-messages';
import { emitRosterUpdated } from '@/lib/events/roster-events';
import { reportUnexpectedError } from '@/lib/monitoring/errorReporting';

type LaunchQueueWindow = Window & {
  launchQueue?: {
    setConsumer: (
      callback: (launchParams: { files: FileSystemFileHandle[] }) => Promise<void>
    ) => void;
  };
};

export function LaunchQueueHandler() {
  const { user } = useAuth();
  const registered = useRef(false);

  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    const w = window as LaunchQueueWindow;
    if (!w.launchQueue || registered.current) return;
    registered.current = true;

    w.launchQueue.setConsumer(async (launchParams) => {
      const handles = launchParams.files ?? [];
      for (const handle of handles) {
        try {
          const file = await handle.getFile();
          if (!isOfficialCrewRosterFileName(file.name)) {
            toast.error('Use um PDF cujo nome comece com CrewRosterReport.');
            continue;
          }
          const res = await importPdfFile(file, user.id);
          if (res.duplicate) {
            toast.info(ROSTER_UX_MESSAGES.scaleAlreadyImported);
            continue;
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
              reason: 'official_pdf_import',
              at: new Date().toISOString(),
            });
          } else if (res.error) {
            toast.error(res.error);
          }
        } catch (e) {
          reportUnexpectedError(e, { flow: 'roster_pdf_launch_queue' });
          toast.error('Não foi possível abrir o arquivo.');
        }
      }
    });
  }, [user]);

  return null;
}
