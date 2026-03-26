import type { CrewSituationDisplay } from "@/services/flightBoard/types";
import {
  crewRoleBadgeClass,
  tripStatusBadgeClass,
} from "@/lib/roster/crew-tripulante-display";
import { cn } from "@/lib/utils";

interface CrewTripulanteSummaryProps {
  crew: CrewSituationDisplay;
  className?: string;
}

export function CrewTripulanteSummary({ crew, className }: CrewTripulanteSummaryProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className={tripStatusBadgeClass(crew.tripStatusVariant)}>
        Situação: {crew.tripStatusLabel}
      </span>
      {!crew.minimizeRole && (
        <span className={crewRoleBadgeClass()}>Função: {crew.roleLabel}</span>
      )}
      {crew.minimizeRole && (
        <span className="text-[10px] text-muted-foreground">
          Função: <span className="font-medium text-foreground">{crew.roleLabel}</span>
        </span>
      )}
    </div>
  );
}
