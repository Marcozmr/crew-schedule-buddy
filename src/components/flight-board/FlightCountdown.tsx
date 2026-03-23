import { formatFlightTimeRemaining } from "@/services/flightBoard/flightDateUtils";

interface FlightCountdownProps {
  scheduledTimestamp: number;
  now: number;
  mode: "departure" | "arrival";
  statusKey: string;
  className?: string;
}

export function FlightCountdown({
  scheduledTimestamp,
  now,
  mode,
  statusKey,
  className,
}: FlightCountdownProps) {
  const completed = ["completed", "cancelled"].includes(statusKey);
  if (completed) return null;

  const text = formatFlightTimeRemaining(scheduledTimestamp, now, mode);
  const isUrgent =
    scheduledTimestamp - now > 0 &&
    scheduledTimestamp - now < 2 * 60 * 60 * 1000;

  return (
    <span
      className={`text-xs font-medium ${
        isUrgent ? "text-primary" : "text-muted-foreground"
      } ${className ?? ""}`}
    >
      {text}
    </span>
  );
}
