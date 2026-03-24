import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { ROSTER_UX_MESSAGES } from '@/lib/roster/roster-ux-messages';
import { downloadActiveRoster } from '@/modules/roster/services/ActiveRosterDownloadService';

export function useActiveRosterDownload() {
  const { user } = useAuth();
  const [downloading, setDownloading] = useState(false);

  const downloadCurrent = useCallback(async () => {
    if (!user) {
      toast.error('Faça login para baixar a escala.');
      return;
    }
    setDownloading(true);
    toast.message(ROSTER_UX_MESSAGES.downloadingCurrent);
    const result = await downloadActiveRoster(user.id);
    setDownloading(false);

    if (!result.ok) {
      toast.error(
        result.code === 'NO_PDF_IN_STORAGE'
          ? ROSTER_UX_MESSAGES.downloadNoPdfInStorage
          : ROSTER_UX_MESSAGES.downloadUnavailable
      );
      return;
    }

    toast.success(ROSTER_UX_MESSAGES.downloadComplete, {
      description: result.fileName,
    });
  }, [user]);

  return { downloading, downloadCurrent };
}
