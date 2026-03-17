import { useEffect, useMemo, useRef, useState } from 'react';
import { getISODateInTimeZone, getISOMonthInTimeZone } from '@/lib/date-utils';

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export function useOperationalClock(timezone = DEFAULT_TIMEZONE, onDayChange?: () => void) {
  const [now, setNow] = useState(() => new Date());
  const dayRef = useRef(getISODateInTimeZone(new Date(), timezone));

  useEffect(() => {
    dayRef.current = getISODateInTimeZone(new Date(), timezone);
  }, [timezone]);

  useEffect(() => {
    const tick = () => {
      const current = new Date();
      const currentDay = getISODateInTimeZone(current, timezone);
      if (currentDay !== dayRef.current) {
        dayRef.current = currentDay;
        onDayChange?.();
      }
      setNow(current);
    };

    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, [timezone, onDayChange]);

  const todayStr = useMemo(() => getISODateInTimeZone(now, timezone), [now, timezone]);
  const monthStr = useMemo(() => getISOMonthInTimeZone(now, timezone), [now, timezone]);

  return { now, todayStr, monthStr };
}
