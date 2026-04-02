import { useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PageSection } from "@/components/presentation/PremiumChrome";
import { FlightBoard } from "@/components/flight-board";
import { useScheduleData } from "@/hooks/useScheduleData";
import { useOperationalPreferences } from "@/hooks/useOperationalPreferences";
import { useOperationalClock } from "@/hooks/useOperationalClock";
import { resolveSafeIANATimezone } from "@/lib/date-utils";

/**
 * EscalaX Pro Board — consulta por aeroporto, modos de painel, voos ao vivo e enriquecimento.
 * Separado do Dashboard, que foca apenas na escala pessoal do dia.
 */
export default function ProBoardPage() {
  const { schedule, loading, reload, dashboardRosterSource } = useScheduleData();
  const { timezone } = useOperationalPreferences();
  const safeTz = useMemo(() => resolveSafeIANATimezone(timezone), [timezone]);
  const { todayStr } = useOperationalClock(safeTz, reload);

  return (
    <AppLayout>
      <PageSection className="space-y-6 pb-10">
        <div className="rounded-[var(--radius-card,1.25rem)] border border-slate-200/70 bg-slate-50/80 px-5 py-4 dark:border-border dark:bg-muted/25">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Consulta por aeroporto, filtros e dados ao vivo (OpenSky). Para o seu dia na escala, use o{" "}
            <span className="font-medium text-foreground">Dashboard</span>.
          </p>
        </div>

        <FlightBoard
          schedule={schedule}
          scheduleLoading={loading}
          operationalTodayIso={todayStr}
          operationalTimezone={safeTz}
          scheduleSourceLabel={dashboardRosterSource?.sourceLabel}
        />
      </PageSection>
    </AppLayout>
  );
}
