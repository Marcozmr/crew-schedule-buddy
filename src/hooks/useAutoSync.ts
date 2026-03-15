import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { importScheduleFromGmail, isGmailScopeError } from '@/lib/gmail-import';
import { toast } from 'sonner';

const PROVIDER_TOKEN_KEY = 'google_provider_token';

export function useAutoSync(onComplete?: () => void) {
  const { user, session, refreshProfile } = useAuth();
  const syncAttemptRef = useRef(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(
    localStorage.getItem('last_sync_time')
  );
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!user || !session || syncAttemptRef.current) return;

    const tokenFingerprint = session.access_token.slice(0, 24);
    const syncKey = `gmail_auto_sync_v6_${user.id}_${tokenFingerprint}`;

    if (sessionStorage.getItem(syncKey)) {
      syncAttemptRef.current = true;
      return;
    }

    const tokenFromSession = (session as { provider_token?: string | null }).provider_token;
    if (tokenFromSession) localStorage.setItem(PROVIDER_TOKEN_KEY, tokenFromSession);

    const providerToken = tokenFromSession ?? localStorage.getItem(PROVIDER_TOKEN_KEY);
    if (!providerToken) return;

    syncAttemptRef.current = true;

    const run = async () => {
      setSyncing(true);
      try {
        const result = await importScheduleFromGmail(user.id, providerToken, {
          searchQuery: 'has:attachment filename:pdf newer_than:180d',
          subjectContains: 'CrewRosterReport',
          senderContains: 'iFlight',
        });

        if (result.importedCount > 0) {
          toast.success(`Escala importada automaticamente: ${result.importedCount} voo(s).`);
          await refreshProfile();
        }

        const now = new Date().toLocaleString('pt-BR');
        localStorage.setItem('last_sync_time', now);
        setLastSyncTime(now);
        onComplete?.();
      } catch (error) {
        if (isGmailScopeError(error)) {
          toast.error('Permissão do Gmail não concedida. Refaça o login Google.');
        }
      } finally {
        sessionStorage.setItem(syncKey, 'done');
        setSyncing(false);
      }
    };

    void run();
  }, [user, session, refreshProfile, onComplete]);

  return { syncing, lastSyncTime };
}
