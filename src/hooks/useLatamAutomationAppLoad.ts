import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useAutomationSessionFromSupabase } from '@/hooks/useAutomationSessionFromSupabase';
import { isRosterAutomationConfigured, postLatamConnect, postLatamSync } from '@/lib/roster-automation-api';
import { decideLatamAppLoadKick } from '@/lib/roster/automation-orchestration';
import { reportUnexpectedError } from '@/lib/monitoring/errorReporting';

const LAST_SYNC_PREFIX = 'escalax_latam_app_last_sync_ms_';
const INITIAL_CONNECT_PREFIX = 'escalax_latam_app_initial_connect_';

function readLastAppLoadSyncMs(userId: string): number | null {
  try {
    const v = sessionStorage.getItem(LAST_SYNC_PREFIX + userId);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeLastAppLoadSyncMs(userId: string) {
  try {
    sessionStorage.setItem(LAST_SYNC_PREFIX + userId, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function readInitialConnectDone(userId: string): boolean {
  try {
    return sessionStorage.getItem(INITIAL_CONNECT_PREFIX + userId) === '1';
  } catch {
    return false;
  }
}

function writeInitialConnectDone(userId: string) {
  try {
    sessionStorage.setItem(INITIAL_CONNECT_PREFIX + userId, '1');
  } catch {
    /* ignore */
  }
}

/**
 * Orquestração invisível: ao abrir a app com sessão Supabase, dispara connect (primeira vez)
 * ou sync (sessão válida / retomada) sem depender do cartão de UI.
 */
export function LatamAutomationAppLoad(): null {
  const { user, session: authSession, emailConfirmed } = useAuth();
  const getAccessToken = useCallback(async () => authSession?.access_token ?? null, [authSession?.access_token]);

  const { session, latestRun, loading, fetchError } = useAutomationSessionFromSupabase(
    emailConfirmed ? user?.id : undefined,
  );

  const inFlight = useRef(false);
  const lastKickKey = useRef<string | null>(null);

  useEffect(() => {
    lastKickKey.current = null;
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !emailConfirmed || !isRosterAutomationConfigured()) return;
    if (loading || fetchError) return;
    if (inFlight.current) return;

    const kick = decideLatamAppLoadKick(session, latestRun, {
      lastAppLoadSyncAt: readLastAppLoadSyncMs(user.id),
      initialConnectAttempted: readInitialConnectDone(user.id),
    });
    if (!kick) return;

    const key = `app:${kick.action}:${session?.id ?? 'none'}:${latestRun?.id ?? 'none'}:${session?.status ?? ''}`;
    if (lastKickKey.current === key) return;

    void (async () => {
      inFlight.current = true;
      try {
        if (kick.action === 'connect') {
          await postLatamConnect(getAccessToken);
          writeInitialConnectDone(user.id);
          if (import.meta.env.DEV) {
            console.info('[roster-automation] app-load connect dispatched');
          }
        } else {
          const sid = session?.id;
          if (!sid) {
            inFlight.current = false;
            return;
          }
          await postLatamSync(getAccessToken, sid);
          writeLastAppLoadSyncMs(user.id);
          if (import.meta.env.DEV) {
            console.info('[roster-automation] app-load sync dispatched');
          }
        }
        lastKickKey.current = key;
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[LatamAutomationAppLoad]', e);
        }
        reportUnexpectedError(e, {
          flow: 'roster_automation_app_load',
          extra: { action: kick.action, sessionStatus: session?.status },
        });
      } finally {
        inFlight.current = false;
      }
    })();
  }, [user?.id, emailConfirmed, loading, fetchError, session, latestRun, getAccessToken]);

  return null;
}
