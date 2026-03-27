import type { CrewSituationDisplay } from "@/services/flightBoard/types";
import {
  fallbackRoleFromFriendlyLabel,
  fallbackSituationFromLongText,
  isDisplayableCrewSigla,
} from "@/lib/roster/crew-display-abbrev";
import { getCrewActivityTooltipPt, getCrewActivityVisualType } from "@/lib/roster/crew-activity-visual";
import { CrewActivityGlyph } from "@/components/roster/CrewActivityGlyph";
import type { ScheduleEntry } from "@/hooks/useScheduleData";
import { cn } from "@/lib/utils";
import type { CrewActivityVisualType } from "@/lib/roster/crew-activity-visual";

interface CrewTripulanteSummaryProps {
  crew: CrewSituationDisplay;
  /** Quando disponível, o ícone segue a mesma lógica do roster (PS/OP, EXTRA, etc.). */
  scheduleEntry?: ScheduleEntry;
  className?: string;
}

function resolveVisualType(
  crew: CrewSituationDisplay,
  scheduleEntry?: ScheduleEntry,
): CrewActivityVisualType {
  if (scheduleEntry) return getCrewActivityVisualType(scheduleEntry);
  return crew.tripStatusVariant === "extra_remunerado" ? "extra_seat" : "flight";
}

export function CrewTripulanteSummary({ crew, scheduleEntry, className }: CrewTripulanteSummaryProps) {
  const sit = crew.tripStatusSigla ?? fallbackSituationFromLongText(crew.tripStatusLabel);
  const role = crew.roleSigla ?? fallbackRoleFromFriendlyLabel(crew.roleLabel);
  const visual = resolveVisualType(crew, scheduleEntry);
  const tip = getCrewActivityTooltipPt(visual);

  if (crew.minimizeRole) {
    return (
      <div
        className={cn("flex flex-wrap items-center gap-1.5 min-w-0", className)}
        title={tip}
      >
        <span className="inline-flex items-center gap-1">
          <CrewActivityGlyph type={visual} />
          <span className="text-[11px] font-bold tracking-tight text-black dark:text-white">{sit}</span>
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2 min-w-0", className)} title={tip}>
      <span className="text-[11px] font-bold tracking-tight text-black dark:text-white">{sit}</span>
      {isDisplayableCrewSigla(role) && (
        <>
          <span className="shrink-0 text-muted-foreground">·</span>
          <span className="inline-flex items-center gap-1">
            <CrewActivityGlyph type={visual} />
            <span className="text-[11px] font-bold tracking-tight text-black dark:text-white">{role}</span>
          </span>
        </>
      )}
    </div>
  );
}
