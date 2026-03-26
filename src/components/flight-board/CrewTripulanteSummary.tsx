import type { CrewSituationDisplay } from "@/services/flightBoard/types";
import {
  fallbackRoleFromFriendlyLabel,
  fallbackSituationFromLongText,
  isDisplayableCrewSigla,
} from "@/lib/roster/crew-display-abbrev";
import { cn } from "@/lib/utils";

interface CrewTripulanteSummaryProps {
  crew: CrewSituationDisplay;
  className?: string;
}

export function CrewTripulanteSummary({ crew, className }: CrewTripulanteSummaryProps) {
  const sit = crew.tripStatusSigla ?? fallbackSituationFromLongText(crew.tripStatusLabel);
  const role = crew.roleSigla ?? fallbackRoleFromFriendlyLabel(crew.roleLabel);

  return (
    <div className={cn("flex flex-wrap items-center gap-2 min-w-0", className)}>
      <span className="text-[11px] font-bold tracking-tight text-black dark:text-white">{sit}</span>
      {!crew.minimizeRole && isDisplayableCrewSigla(role) && (
        <>
          <span className="shrink-0 text-muted-foreground">·</span>
          <span className="text-[11px] font-bold tracking-tight text-black dark:text-white">{role}</span>
        </>
      )}
    </div>
  );
}
