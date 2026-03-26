import { useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
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
      <div className="space-y-4 pb-6">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">
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
      </div>
    </AppLayout>
  );
}
