import { cn } from "@/lib/utils";
import type { FlightStatusKey } from "@/services/flightBoard/types";

const statusStyles: Record<
  FlightStatusKey,
  { bg: string; text: string; border: string }
> = {
  on_time: "bg-success/12 text-success border-success/30",
  boarding: "bg-primary/12 text-primary border-primary/30",
  next: "bg-primary/10 text-primary border-primary/25",
  delayed: "bg-warning/15 text-warning border-warning/40",
  cancelled: "bg-destructive/15 text-destructive border-destructive/40",
  completed: "bg-muted text-muted-foreground border-border",
  unknown: "bg-muted/80 text-muted-foreground border-border",
};

interface FlightStatusBadgeProps {
  statusKey: FlightStatusKey;
  label: string;
  className?: string;
}

export function FlightStatusBadge({
  statusKey,
  label,
  className,
}: FlightStatusBadgeProps) {
  const style = statusStyles[statusKey] ?? statusStyles.unknown;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold",
        style.bg,
        style.text,
        style.border,
        className
      )}
    >
      {label}
    </span>
  );
}
