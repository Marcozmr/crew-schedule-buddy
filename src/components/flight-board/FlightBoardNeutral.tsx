import { CalendarOff, Plane } from "lucide-react";

interface FlightBoardNeutralProps {
  title: string;
  subtitle?: string;
  /** Quando o dia não tem voo mas há contexto de aeroporto (filtro) / minha base (escala) */
  airportHint?: string;
  variant?:
    | "no_flight_day"
    | "no_entries"
    | "no_airport_ops"
    | "no_schedule"
    | "airport_base_empty";
}

export function FlightBoardNeutral({
  title,
  subtitle,
  airportHint,
  variant = "no_flight_day",
}: FlightBoardNeutralProps) {
  const Icon = variant === "no_schedule" ? CalendarOff : Plane;

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-muted/20 px-6 py-10 text-center">
      <Icon className="mb-3 h-10 w-10 text-muted-foreground/50" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {subtitle && (
        <p className="mt-2 max-w-md text-xs text-muted-foreground">{subtitle}</p>
      )}
      {airportHint && (
        <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
          {airportHint}
        </p>
      )}
    </div>
  );
}
