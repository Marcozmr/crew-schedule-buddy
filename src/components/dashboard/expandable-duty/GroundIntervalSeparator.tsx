import { formatOperationalDuration } from '@/lib/roster/operational-intervals';

interface GroundIntervalSeparatorProps {
  minutes: number;
  variant?: 'solo' | 'rest';
  /** Texto opcional para próxima apresentação (ex.: horário) */
  nextPresentationHint?: string;
}

export function GroundIntervalSeparator({
  minutes,
  variant = 'solo',
  nextPresentationHint,
}: GroundIntervalSeparatorProps) {
  const label =
    variant === 'rest'
      ? 'Descanso até próxima apresentação'
      : 'Intervalo em solo';

  return (
    <div
      className="flex flex-col items-center gap-1 border-y border-border/50 bg-muted/20 py-3 px-3"
      role="separator"
    >
      <div className="h-px w-full max-w-[200px] bg-gradient-to-r from-transparent via-border to-transparent" />
      <p className="text-center text-[10px] font-medium text-muted-foreground">
        {label}
      </p>
      <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
        {formatOperationalDuration(minutes)}
      </p>
      {nextPresentationHint && (
        <p className="text-center text-[10px] text-muted-foreground">{nextPresentationHint}</p>
      )}
    </div>
  );
}
