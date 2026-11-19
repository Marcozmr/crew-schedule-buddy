import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { DutyPeriod } from '@/lib/duty-grouping';
import { formatDateBR } from '@/lib/date-utils';
import { legWeatherQuery, useLegWeather } from '@/hooks/useLegWeather';
import { FlightCard } from './FlightCard';

interface Props {
  duty: DutyPeriod;
  todayStr: string;
  /** Animate delay multiplier */
  delay?: number;
  /** Suppress the "Hoje / Amanhã" date header (when parent already shows it) */
  hideDateLabel?: boolean;
}

export function DutyFlightsSection({ duty, todayStr, delay = 0, hideDateLabel = false }: Props) {
  const flightLegs = useMemo(
    () => duty.legs.filter(l => l.is_flight && l.departure && l.arrival),
    [duty]
  );

  const weatherQueries = useMemo(
    () => flightLegs.map(legWeatherQuery).filter((q): q is NonNullable<typeof q> => q != null),
    [flightLegs]
  );

  const legWeather = useLegWeather(weatherQueries);

  if (flightLegs.length === 0) return null;

  const isToday = duty.dutyStartDate === todayStr;
  const isTomorrow = (() => {
    const tomorrow = new Date(todayStr);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return duty.dutyStartDate === tomorrow.toISOString().slice(0, 10);
  })();

  const dateLabel = isToday
    ? 'Hoje'
    : isTomorrow
    ? `Amanhã · ${formatDateBR(duty.dutyStartDate)}`
    : formatDateBR(duty.dutyStartDate);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.28, ease: 'easeOut' }}
      className="space-y-3"
    >
      {/* Date header */}
      {!hideDateLabel && (
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-primary">{dateLabel}</p>
          {duty.reportTime && (
            <span className="text-xs text-muted-foreground">· Apresentação {duty.reportTime}</span>
          )}
        </div>
      )}

      {/* Flight cards */}
      {flightLegs.map((leg, i) => {
        const isFirst = i === 0;
        const isLast = i === flightLegs.length - 1;
        return (
          <FlightCard
            key={leg.id}
            leg={leg}
            weather={legWeather[leg.id]}
            reportTime={isFirst ? duty.reportTime : undefined}
            debriefTime={isLast ? duty.debriefTime : undefined}
            showMetButton={isLast}
          />
        );
      })}
    </motion.div>
  );
}
