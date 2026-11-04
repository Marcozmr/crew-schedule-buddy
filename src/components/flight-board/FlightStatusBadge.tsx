import { cn } from "@/lib/utils";
import type { FlightStatusKey } from "@/services/flightBoard/types";

const statusStyles: Record<
  FlightStatusKey,
  { bg: string; text: string; border: string }
> = {
  on_time: { bg: "bg-success/12", text: "text-success", border: "border-success/30" },
  boarding: { bg: "bg-primary/12", text: "text-primary", border: "border-primary/30" },
  next: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/25" },
  delayed: { bg: "bg-warning/15", text: "text-warning", border: "border-warning/40" },
  cancelled: { bg: "bg-destructive/15", text: "text-destructive", border: "border-destructive/40" },
  completed: { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" },
  unknown: { bg: "bg-muted/80", text: "text-muted-foreground", border: "border-border" },
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
