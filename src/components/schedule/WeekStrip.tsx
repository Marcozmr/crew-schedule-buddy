import { useMemo } from 'react';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { DAY_KIND_META, dayKey, dayKindForEntries, groupEntriesByDay } from '@/lib/roster/day-kind';

const LETTERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

interface Props {
  schedule: ScheduleEntry[];
  today: Date;
  onSelectDay(date: Date): void;
}

/** Os 7 dias a partir de hoje, cada um com a cor e a sigla do tipo de dia. */
export function WeekStrip({ schedule, today, onSelectDay }: Props) {
  const byDay = useMemo(() => groupEntriesByDay(schedule), [schedule]);
  const days = Array.from({ length: 7 }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));

  return (
    <div className="flex gap-1.5">
      {days.map((d, i) => {
        const meta = DAY_KIND_META[dayKindForEntries(byDay.get(dayKey(d)) ?? [])];
        const isToday = i === 0;
        return (
          <button
            key={dayKey(d)}
            type="button"
            onClick={() => onSelectDay(d)}
            aria-current={isToday ? 'date' : undefined}
            aria-label={`${WEEKDAYS[d.getDay()]}, ${d.getDate()}: ${meta.label}`}
            className={`flex h-[62px] min-w-0 flex-1 flex-col items-center justify-center gap-px rounded-2xl ${meta.className} ${
              isToday ? 'ring-2 ring-foreground ring-offset-0' : ''
            }`}
          >
            <span className="text-[10px] font-semibold leading-none">{LETTERS[d.getDay()]}</span>
            <span className={`text-[17px] leading-tight ${isToday ? 'font-extrabold' : 'font-bold'}`}>{d.getDate()}</span>
            <span className="h-[11px] text-[9px] font-extrabold leading-none tracking-wide">{meta.sigla}</span>
          </button>
        );
      })}
    </div>
  );
}
