import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
  Upload,
  Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { PdfImportDialog } from '@/components/PdfImportDialog';
import { useAuth } from '@/lib/auth-context';
import { useUserRosterConnection } from '@/hooks/useUserRosterConnection';
import { RosterSyncService } from '@/modules/roster/services/RosterSyncService';
import { UserRosterConnectionService, type RosterConnectionState } from '@/modules/roster/services/UserRosterConnectionService';
import { corporatePortalConfig, isLoginUrlConfigured } from '@/lib/corporate-portal-config';
import { emitRosterUpdated, subscribeRosterUpdated } from '@/lib/events/roster-events';
import { toast } from 'sonner';
import { CONNECT_ROSTER_ONBOARDING } from '@/lib/roster/connect-roster-onboarding-copy';

function stepCompletion(rs: RosterConnectionState | undefined, portalConnected: boolean) {
  const s4 = rs === 'roster_connected';
  const s3 = rs === 'iflight_accessed' || s4;
  const s2 = rs === 'awaiting_iflight_roster' || rs === 'portal_connected' || s3;
  const s1 = portalConnected || s2;
  return { step1: s1, step2: s2, step3: s3, step4: s4 };
}

function activeStepIndex(done: { step1: boolean; step2: boolean; step3: boolean; step4: boolean }): number {
  if (!done.step1) return 0;
  if (!done.step2) return 1;
  if (!done.step3) return 2;
  if (!done.step4) return 3;
  return 4;
}

export default function ConnectRosterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { connection, activeRosterMeta, loading, refresh } = useUserRosterConnection();
  const [portalConnecting, setPortalConnecting] = useState(false);
  const [portalOk, setPortalOk] = useState(false);

  const rs = connection?.roster_connection_state ?? 'idle';

  useEffect(() => {
    let cancelled = false;
    void RosterSyncService.getProviderStatus('corporate_portal').then((s) => {
      if (!cancelled) setPortalOk(s.status === 'connected');
    });
    return () => {
      cancelled = true;
    };
  }, [loading, connection?.roster_connection_state, portalConnecting]);

  useEffect(() => {
    const fn = () => {
      void RosterSyncService.getProviderStatus('corporate_portal').then((s) => setPortalOk(s.status === 'connected'));
    };
    window.addEventListener('escalax-corporate-connection-changed', fn);
    return () => window.removeEventListener('escalax-corporate-connection-changed', fn);
  }, []);

  useEffect(() => {
    if (!user) return;
    return subscribeRosterUpdated((d) => {
      if (d.userId !== user.id) return;
      void refresh();
    });
  }, [user, refresh]);

  const done = useMemo(() => stepCompletion(rs, portalOk), [rs, portalOk]);
  const currentIdx = useMemo(() => activeStepIndex(done), [done]);

  const showWaitingPortal = portalOk && rs === 'awaiting_iflight_roster';

  const bumpPortal = useCallback(() => {
    void RosterSyncService.getProviderStatus('corporate_portal').then((s) => setPortalOk(s.status === 'connected'));
  }, []);

  const handleConnectPortal = useCallback(async () => {
    const provider = RosterSyncService.getProviderById('corporate_portal');
    setPortalConnecting(true);
    try {
      await provider.connect();
    } finally {
      setPortalConnecting(false);
      void refresh();
      bumpPortal();
    }
  }, [bumpPortal, refresh]);

  const handleOpenedIFlight = useCallback(() => {
    if (!user) return;
    void UserRosterConnectionService.setRosterConnectionState(user.id, 'iflight_accessed').then(() => {
      emitRosterUpdated({
        userId: user.id,
        reason: 'active_roster_changed',
        at: new Date().toISOString(),
      });
      void refresh();
    });
  }, [user, refresh]);

  const handleImportComplete = useCallback(async () => {
    await refresh();
    toast.success(CONNECT_ROSTER_ONBOARDING.successTitle, {
      description: CONNECT_ROSTER_ONBOARDING.successDescription,
    });
    navigate('/dashboard', { replace: true });
  }, [refresh, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (connection?.roster_connection_state === 'roster_connected' || activeRosterMeta) {
    return <Navigate to="/dashboard" replace />;
  }

  const steps = CONNECT_ROSTER_ONBOARDING.steps;

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-dark px-4 py-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="text-primary-foreground p-1 rounded-lg hover:bg-white/10"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-primary-foreground">{CONNECT_ROSTER_ONBOARDING.pageTitle}</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-8 pb-24">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-1">
            <Sparkles className="w-7 h-7" />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed px-1">{CONNECT_ROSTER_ONBOARDING.intro}</p>
        </motion.div>

        <div className="space-y-3">
          {steps.map((label, i) => {
            const completed =
              i === 0 ? done.step1 : i === 1 ? done.step2 : i === 2 ? done.step3 : done.step4;
            const active = currentIdx === i && !completed;

            return (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-2xl border p-4 flex gap-3 items-start transition-colors ${
                  completed
                    ? 'border-success/35 bg-success/[0.06]'
                    : active
                      ? 'border-primary/40 bg-primary/[0.06] ring-1 ring-primary/15'
                      : 'border-border bg-card/50'
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {completed ? (
                    <CheckCircle2 className="w-6 h-6 text-success" />
                  ) : active ? (
                    <div className="w-6 h-6 rounded-full border-2 border-primary flex items-center justify-center text-xs font-bold text-primary">
                      {i + 1}
                    </div>
                  ) : (
                    <Circle className="w-6 h-6 text-muted-foreground/50" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      completed ? 'text-foreground' : active ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    <span className="text-muted-foreground font-normal mr-1.5">{i + 1}.</span>
                    {label}
                  </p>
                  {active && i === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{CONNECT_ROSTER_ONBOARDING.hintStep1}</p>
                  )}
                  {active && i === 1 && (
                    <p className="text-xs text-muted-foreground mt-1">{CONNECT_ROSTER_ONBOARDING.hintStep2}</p>
                  )}
                  {active && i === 2 && (
                    <p className="text-xs text-muted-foreground mt-1">{CONNECT_ROSTER_ONBOARDING.hintStep3}</p>
                  )}
                  {active && i === 3 && (
                    <p className="text-xs text-muted-foreground mt-1">{CONNECT_ROSTER_ONBOARDING.hintStep4}</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {showWaitingPortal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 space-y-2"
          >
            <p className="text-sm text-foreground font-medium">{CONNECT_ROSTER_ONBOARDING.waitingMessage}</p>
            <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200/90">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>{CONNECT_ROSTER_ONBOARDING.waitingPulse}</span>
            </div>
          </motion.div>
        )}

        {rs === 'iflight_accessed' && !done.step4 && (
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
            <p className="text-sm text-foreground">{CONNECT_ROSTER_ONBOARDING.readyToImport}</p>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card/80 p-4 space-y-3 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{CONNECT_ROSTER_ONBOARDING.actionsTitle}</p>
          <div className="flex flex-col gap-2">
            {corporatePortalConfig.isEnabled && isLoginUrlConfigured() && (
              <Button
                type="button"
                className="w-full justify-center gap-2"
                disabled={portalConnecting}
                onClick={() => void handleConnectPortal()}
              >
                {portalConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                {CONNECT_ROSTER_ONBOARDING.openPortal}
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleOpenedIFlight}
              disabled={!portalOk && rs === 'idle'}
            >
              {CONNECT_ROSTER_ONBOARDING.openedIFlight}
            </Button>
            <PdfImportDialog
              onImportComplete={() => void handleImportComplete()}
              trigger={
                <Button type="button" variant="default" className="w-full gap-2 bg-primary">
                  <Upload className="w-4 h-4" />
                  {CONNECT_ROSTER_ONBOARDING.importPdf}
                </Button>
              }
            />
            <Button type="button" variant="ghost" className="w-full text-muted-foreground" asChild>
              <Link to="/dashboard">{CONNECT_ROSTER_ONBOARDING.backDashboard}</Link>
            </Button>
          </div>
        </div>

        {!isLoginUrlConfigured() && corporatePortalConfig.isEnabled && (
          <p className="text-xs text-center text-muted-foreground px-2">{CONNECT_ROSTER_ONBOARDING.portalNotConfigured}</p>
        )}
      </div>
    </div>
  );
}
