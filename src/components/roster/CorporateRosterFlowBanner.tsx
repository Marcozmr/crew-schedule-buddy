import { Link } from 'react-router-dom';
import { Signpost, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserRosterConnection } from '@/hooks/useUserRosterConnection';
import { CORPORATE_ROSTER_FLOW } from '@/lib/roster/roster-ux-messages';
import { isRosterAutomationConfigured } from '@/lib/roster-automation-api';

/**
 * Lembrete no dashboard quando o usuário ainda está no fluxo portal → iFlight → PDF
 * (sem escala ativa). Evita sensação de “fluxo parado no portal”.
 */
export function CorporateRosterFlowBanner() {
  const { connection, activeRosterMeta, loading } = useUserRosterConnection();
  const state = connection?.roster_connection_state ?? 'idle';

  /** Com automação configurada, o progresso fica no cartão dedicado — evita CTA duplicado de importação manual. */
  if (isRosterAutomationConfigured()) return null;

  if (loading || activeRosterMeta) return null;

  const inFlow =
    state === 'awaiting_iflight_roster' ||
    state === 'iflight_accessed' ||
    state === 'portal_connected';

  if (!inFlow) return null;

  const iflightDone = state === 'iflight_accessed';

  return (
    <div
      className="mb-6 rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.07] via-card to-card px-4 py-4 sm:px-5 ring-1 ring-amber-500/10"
      role="status"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
            <Signpost className="w-5 h-5 text-amber-700 dark:text-amber-400" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="font-semibold text-foreground text-sm sm:text-base">
              {iflightDone ? CORPORATE_ROSTER_FLOW.importPrimaryTitle : CORPORATE_ROSTER_FLOW.awaitingTitle}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {iflightDone ? CORPORATE_ROSTER_FLOW.importPrimaryLead : CORPORATE_ROSTER_FLOW.awaitingLead}
            </p>
            {!iflightDone && (
              <p className="text-xs text-muted-foreground pt-1">{CORPORATE_ROSTER_FLOW.awaitingReturnHint}</p>
            )}
            {iflightDone && (
              <p className="text-xs text-muted-foreground pt-1 border-t border-border/60 mt-2 pt-2">
                {CORPORATE_ROSTER_FLOW.importPrimaryReassurance}
              </p>
            )}
          </div>
        </div>
        <Button asChild size="sm" className="shrink-0 gap-1.5 w-full sm:w-auto">
          <Link to="/conectar-escala">
            {CORPORATE_ROSTER_FLOW.dashboardHintCta}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
