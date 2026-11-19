import { useMemo } from 'react';
import { Bed, Calendar, Clock, GraduationCap, Plane, Stethoscope, Sun, type LucideIcon } from 'lucide-react';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { parseDateBRT } from '@/lib/date-utils';
import { DAY_KIND_META, kindOf, type DayKind } from '@/lib/roster/day-kind';
import { compareScheduleEntries } from '@/lib/schedule-entry-sort';

const ICONS: Record<DayKind, LucideIcon> = {
  voo: Plane,
  folga: Bed,
  sobreaviso: Clock,
  reserva: Clock,
  curso: GraduationCap,
  ferias: Sun,
  dispensa: Stethoscope,
  outro: Calendar,
  vazio: Calendar,
};

const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

function titleOf(e: ScheduleEntry): string {
  if (e.is_flight) return `${e.departure?.trim()} → ${e.arrival?.trim()}`;
  return e.crew_status_label || e.activity_label || e.activity_type || 'Atividade';
}

function subtitleOf(e: ScheduleEntry): string {
  if (e.is_flight) return [e.flight_number, e.aircraft_type].filter(Boolean).join(' · ');
  // Apresentação na noite anterior: diz qual voo vem depois.
  if (e.activity_type === 'APR' && e.flight_number) return `Voo ${e.flight_number} · ${e.departure?.trim()} → ${e.arrival?.trim()}`;
  return e.hotel_name ?? '';
}

function timeOf(e: ScheduleEntry): string {
  const a = e.departure_time?.slice(0, 5);
  const b = e.arrival_time?.slice(0, 5);
  if (a && b) return `${a}–${b}`;
  return a || b || '';
}

interface Props {
  entries: ScheduleEntry[];
  onSelectDay(day: number): void;
}

/** Escala do mês em lista, agrupada por dia, com o ícone na cor do tipo de cada lançamento. */
export function ScheduleListView({ entries, onSelectDay }: Props) {
  const days = useMemo(() => {
    const sorted = [...entries].sort(compareScheduleEntries);
    const groups: { day: number; label: string; items: ScheduleEntry[] }[] = [];
    for (const e of sorted) {
      const d = parseDateBRT(e.date);
      const last = groups[groups.length - 1];
      if (last && last.day === d.getDate()) last.items.push(e);
      else groups.push({ day: d.getDate(), label: `${WEEKDAYS[d.getDay()]}, ${d.getDate()} DE ${MONTHS[d.getMonth()]}`, items: [e] });
    }
    return groups;
  }, [entries]);

  return (
    <div className="space-y-4">
      {days.map((g) => (
        <section key={g.day} className="space-y-2.5">
          <h3 className="text-xs font-bold tracking-[0.08em] text-muted-foreground">{g.label}</h3>
          {g.items.map((e) => {
            const kind = kindOf(e);
            const Icon = ICONS[kind];
            const sub = subtitleOf(e);
            const time = timeOf(e);
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => onSelectDay(g.day)}
                className="flex w-full items-center gap-3 rounded-[18px] bg-card p-3.5 text-left shadow-[0_1px_2px_rgba(17,24,39,0.05),0_6px_16px_rgba(17,24,39,0.05)] dark:shadow-none"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${DAY_KIND_META[kind].className}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold text-foreground">{titleOf(e)}</span>
                  {sub && <span className="block truncate text-[13px] text-muted-foreground">{sub}</span>}
                </span>
                {time && <span className="shrink-0 text-sm font-semibold text-foreground">{time}</span>}
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
