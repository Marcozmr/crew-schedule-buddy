import { Info } from "lucide-react";

interface DashboardRosterUpdatedHintProps {
  /** ISO timestamp da última sincronização/atualização do roster ativo */
  lastUpdatedIso: string | null | undefined;
  /** YYYY-MM-DD (data operacional atual) */
  operationalTodayIso: string;
  /** IANA do relógio operacional */
  operationalTimezone: string;
}

/**
 * Aviso leve quando a escala foi atualizada no mesmo dia operacional.
 */
export function DashboardRosterUpdatedHint({
  lastUpdatedIso,
  operationalTodayIso,
  operationalTimezone,
}: DashboardRosterUpdatedHintProps) {
  if (!lastUpdatedIso) return null;

  let dayInTz: string;
  try {
    dayInTz = new Date(lastUpdatedIso).toLocaleDateString("en-CA", {
      timeZone: operationalTimezone,
    });
  } catch {
    return null;
  }

  if (dayInTz !== operationalTodayIso) return null;

  let timeLabel: string;
  try {
    timeLabel = new Date(lastUpdatedIso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: operationalTimezone,
    });
  } catch {
    return null;
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-[11px] leading-snug text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/80" aria-hidden />
      <p>
        Escala atualizada hoje às <span className="font-medium text-foreground">{timeLabel}</span>
      </p>
    </div>
  );
}
