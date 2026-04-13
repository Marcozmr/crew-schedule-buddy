import { useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PageSection } from "@/components/presentation/PremiumChrome";
import { FlightBoard } from "@/components/flight-board";
import { useScheduleData } from "@/hooks/useScheduleData";
import { useOperationalPreferences } from "@/hooks/useOperationalPreferences";
import { useOperationalClock } from "@/hooks/useOperationalClock";
import { resolveSafeIANATimezone } from "@/lib/date-utils";

export default function ProBoardPage() {
  const { schedule, loading, reload, dashboardRosterSource } = useScheduleData();
  const { timezone } = useOperationalPreferences();
  const safeTz = useMemo(() => resolveSafeIANATimezone(timezone), [timezone]);
  const { todayStr } = useOperationalClock(safeTz, reload);

  return (
    <AppLayout>
      <PageSection className="pb-10">
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
