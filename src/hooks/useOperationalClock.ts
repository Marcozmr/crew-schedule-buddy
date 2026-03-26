import { useEffect, useMemo, useRef, useState } from 'react';
import { TZDate } from '@date-fns/tz';
import { getISODateInTimeZone, getISOMonthInTimeZone, resolveSafeIANATimezone } from '@/lib/date-utils';

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

/**
 * Relógio operacional + detecção de virada de dia no fuso do usuário.
 * Ao mudar a data local, chama onDayChange (ex.: recarregar escala) sem depender do módulo de automação de importação.
 */
export function useOperationalClock(rawTimezone = DEFAULT_TIMEZONE, onDayChange?: () => void) {
  const timezone = useMemo(() => resolveSafeIANATimezone(rawTimezone), [rawTimezone]);
  const [now, setNow] = useState(() => new Date());
  const dayRef = useRef(getISODateInTimeZone(new Date(), timezone));
  const onDayChangeRef = useRef(onDayChange);
  onDayChangeRef.current = onDayChange;

  useEffect(() => {
    dayRef.current = getISODateInTimeZone(new Date(), timezone);
  }, [timezone]);

  useEffect(() => {
    const tick = () => {
      const current = new Date();
      const currentDay = getISODateInTimeZone(current, timezone);
      if (currentDay !== dayRef.current) {
        dayRef.current = currentDay;
        onDayChangeRef.current?.();
      }
      setNow(current);
    };

    tick();

    const interval = window.setInterval(tick, 60_000);

    let midnightTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleMidnight = () => {
      if (midnightTimer !== undefined) clearTimeout(midnightTimer);
      const local = new TZDate(Date.now(), timezone);
      const nextMidnight = new TZDate(
        local.getFullYear(),
        local.getMonth(),
        local.getDate() + 1,
        0,
        0,
        0,
        timezone,
      ).getTime();
      const ms = Math.max(1000, nextMidnight - Date.now());
      midnightTimer = window.setTimeout(() => {
        tick();
        scheduleMidnight();
      }, ms);
    };
    scheduleMidnight();

    return () => {
      window.clearInterval(interval);
      if (midnightTimer !== undefined) clearTimeout(midnightTimer);
    };
  }, [timezone]);

  const todayStr = useMemo(() => getISODateInTimeZone(now, timezone), [now, timezone]);
  const monthStr = useMemo(() => getISOMonthInTimeZone(now, timezone), [now, timezone]);

  return { now, todayStr, monthStr };
}
