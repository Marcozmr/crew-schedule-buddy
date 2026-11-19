/**
 * EscalaX — Schedule Calendar (Premium Light)
 */

import { useMemo, useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PdfImportDialog } from '@/components/PdfImportDialog';
import { useScheduleData } from '@/hooks/useScheduleData';
import { Link } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, Building2, RefreshCw } from 'lucide-react';
import { useOperationalClock } from '@/hooks/useOperationalClock';
import { groupIntoDutyPeriods, getNextDutyPeriod } from '@/lib/duty-grouping';
import { DAY_KIND_META, dayKindForEntries } from '@/lib/roster/day-kind';
import { WeekStrip } from '@/components/schedule/WeekStrip';
import { DayKindLegend } from '@/components/schedule/DayKindLegend';
import { NextEventBanner } from '@/components/schedule/NextEventBanner';
import { ScheduleListView } from '@/components/schedule/ScheduleListView';
import { legWeatherQuery, useLegWeather } from '@/hooks/useLegWeather';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { FlightCard } from '@/components/flight/FlightCard';
import { motion } from 'framer-motion';
import { parseDateBRT } from '@/lib/date-utils';
import { compareScheduleEntries } from '@/lib/schedule-entry-sort';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AppCard, EmptyState } from '@/components/ui/primitives';
import { buildCrewSituationDisplayFromEntry } from '@/lib/roster/crew-tripulante-display';
import { CrewTripulanteSummary } from '@/components/flight-board/CrewTripulanteSummary';
import {
  RosterCalendarEventIcon,
  getRosterCalendarContainerClass,
  getRosterCalendarCellPillClass,
} from '@/lib/roster/roster-calendar-icons';
import { getRosterEventVisualType } from '@/lib/roster/roster-calendar-visual';

// Sub-component so hooks run unconditionally per entry list
function DayDetailContent({ entries, monthLabel }: { entries: ReturnType<typeof Array.prototype.filter>; monthLabel: string }) {
  const weatherQueries = useMemo(
    () => (entries as ScheduleEntry[]).filter((e) => e.is_flight).map(legWeatherQuery).filter((q): q is NonNullable<typeof q> => q != null),
    [entries]
  );
  const legWeather = useLegWeather(weatherQueries);

  if (entries.length === 0) {
    return <EmptyState icon={Calendar} title="Sem atividades neste dia" className="my-4" />;
  }

  return (
    <div className="space-y-3">
      {entries.map((entry: ReturnType<typeof Array.prototype.filter>[0], index: number) => {
        const tripCrew = entry.is_flight ? buildCrewSituationDisplayFromEntry(entry) : null;

        if (entry.is_flight) {
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <FlightCard
                leg={entry}
                weather={legWeather[entry.id]}
                reportTime={entry.report_time}
                debriefTime={entry.debrief_time}
                showMetButton
              />
              {tripCrew && (
                <div className="mt-2 glass p-3">
                  <CrewTripulanteSummary crew={tripCrew} scheduleEntry={entry} />
                </div>
              )}
            </motion.div>
          );
        }

        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="min-w-0"
          >
            <AppCard>
              <div className="flex items-start gap-3 px-4 py-3.5 min-w-0">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${getRosterCalendarContainerClass(entry)}`}>
                  <RosterCalendarEventIcon entry={entry} size="md" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="font-semibold text-foreground text-sm break-words">{entry.flight_number || entry.activity_type}</span>
                    <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-full text-muted-foreground whitespace-nowrap">{entry.activity_type}</span>
                  </div>
                  {getRosterEventVisualType(entry) === 'rest' && (
                    <p className="mt-1 text-xs font-semibold text-success">Folga / Descanso</p>
                  )}
                  {entry.hotel_name && (
                    <p className="mt-1.5 flex items-start gap-1.5 break-words text-xs text-muted-foreground">
                      <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{entry.hotel_name}</span>
                    </p>
                  )}
                </div>
              </div>
            </AppCard>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function SchedulePage() {
  const { schedule, reload } = useScheduleData();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [view, setView] = useState<'lista' | 'mes'>('lista');
  const { now, todayStr } = useOperationalClock('America/Sao_Paulo', reload);
  const nextDuty = useMemo(
    () => getNextDutyPeriod(groupIntoDutyPeriods(schedule), todayStr, now, 'America/Sao_Paulo'),
    [schedule, todayStr, now],
  );

  const getMonth = (dateStr: string) => parseDateBRT(dateStr).getMonth();
  const getDay = (dateStr: string) => parseDateBRT(dateStr).getDate();

  useEffect(() => {
    if (schedule.length === 0) return;
    const currentMonth = new Date().getMonth();
    const hasCurrentMonth = schedule.some((entry) => getMonth(entry.date) === currentMonth);
    if (hasCurrentMonth) {
      setSelectedMonth(currentMonth);
      return;
    }
    let latestMonth = -1;
    for (const entry of schedule) {
      const month = getMonth(entry.date);
      if (month > latestMonth) latestMonth = month;
    }
    if (latestMonth >= 0) setSelectedMonth(latestMonth);
  }, [schedule]);

  const filteredSchedule = useMemo(() => schedule.filter((entry) => getMonth(entry.date) === selectedMonth), [schedule, selectedMonth]);

  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    const days: { day: number; entries: typeof schedule }[] = [];
    for (let i = 0; i < firstDay; i += 1) days.push({ day: 0, entries: [] });
    for (let day = 1; day <= daysInMonth; day += 1) {
      days.push({ day, entries: filteredSchedule.filter((entry) => getDay(entry.date) === day) });
    }
    return days;
  }, [filteredSchedule, selectedMonth, selectedYear]);

  const todayDay = new Date().getMonth() === selectedMonth ? new Date().getDate() : -1;
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const selectedEntries = useMemo(() => {
    if (!selectedDay) return [];
    return filteredSchedule
      .filter((entry) => getDay(entry.date) === selectedDay)
      .sort(compareScheduleEntries);
  }, [filteredSchedule, selectedDay]);

  return (
    <AppLayout>
      <div className="space-y-4 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[32px] font-extrabold leading-tight tracking-tight text-foreground">Escala</h1>
          <Link
            to="/minha-escala"
            aria-label="Sincronizar escala"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary"
          >
            <RefreshCw className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>

        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center">
            <button
              type="button"
              aria-label="Mês anterior"
              onClick={() => setSelectedMonth((month) => Math.max(0, month - 1))}
              className="flex h-11 w-8 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <h2 className="whitespace-nowrap text-[15px] font-bold text-foreground">
              {months[selectedMonth].slice(0, 3)} {selectedYear}
            </h2>
            <button
              type="button"
              aria-label="Próximo mês"
              onClick={() => setSelectedMonth((month) => Math.min(11, month + 1))}
              className="flex h-11 w-8 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div role="tablist" aria-label="Modo de ver a escala" className="flex gap-0.5 rounded-xl bg-muted p-[3px]">
            {(['lista', 'mes'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`h-[30px] rounded-[9px] px-3 text-xs font-semibold ${
                  view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                {v === 'lista' ? 'Lista' : 'Mês'}
              </button>
            ))}
            <Link to="/minha-escala" className="flex h-[30px] items-center rounded-[9px] px-3 text-xs font-semibold text-muted-foreground">
              PDF
            </Link>
          </div>
        </div>

        <NextEventBanner nextDuty={nextDuty} now={now} />

        <WeekStrip
          schedule={schedule}
          today={now}
          onSelectDay={(d) => {
            setSelectedMonth(d.getMonth());
            const has = schedule.some((e) => {
              const p = parseDateBRT(e.date);
              return p.getMonth() === d.getMonth() && p.getDate() === d.getDate();
            });
            setSelectedDay(has ? d.getDate() : null);
          }}
        />
        <DayKindLegend />

        {view === 'lista' && (
          <div className="space-y-4">
            {filteredSchedule.length > 0 ? (
              <ScheduleListView entries={filteredSchedule} onSelectDay={setSelectedDay} />
            ) : (
              <EmptyState icon={Calendar} title={`Sem escala em ${months[selectedMonth]}`} className="my-4" />
            )}
            <div className="flex justify-center">
              <PdfImportDialog onImportComplete={reload} />
            </div>
          </div>
        )}

        {view === 'mes' && (
        <div className="glass p-2 sm:p-4 lg:p-6 overflow-hidden min-w-0">
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-2">
            {weekDays.map((day) => (
              <div key={day} className="text-center text-[10px] sm:text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
            {calendarDays.map((item, index) => {
              if (item.day === 0) return <div key={index} />;

              const isToday = item.day === todayDay;
              const isSelected = item.day === selectedDay;
              const meta = DAY_KIND_META[dayKindForEntries(item.entries)];

              return (
                <button
                  key={index}
                  onClick={() => setSelectedDay(item.entries.length > 0 ? item.day : null)}
                  aria-current={isToday ? 'date' : undefined}
                  className={`relative min-h-[58px] sm:min-h-[72px] lg:min-h-[88px] rounded-xl p-1 sm:p-1.5 lg:p-2 text-left transition-all duration-150 overflow-hidden ${
                    isSelected ? 'ring-2 ring-primary' : isToday ? 'ring-2 ring-foreground' : ''
                  } ${item.entries.length > 0 ? meta.className : 'hover:bg-secondary/50'}`}
                >
                  <span className="flex items-center justify-between gap-0.5">
                    <span className={`text-[10px] sm:text-xs ${isToday ? 'font-extrabold' : 'font-semibold'}`}>{item.day}</span>
                    {meta.sigla && <span className="text-[8px] sm:text-[9px] font-extrabold tracking-wide">{meta.sigla}</span>}
                  </span>

                  <div className="mt-1 space-y-0.5 min-w-0">
                    {item.entries.slice(0, 2).map((entry) => (
                      <div
                        key={entry.id}
                        className={`flex min-w-0 items-center gap-0.5 rounded px-1 py-0.5 text-[8px] sm:text-[9px] lg:text-[10px] font-mono truncate ${getRosterCalendarCellPillClass(entry)}`}
                      >
                        <span className="shrink-0 opacity-90">
                          <RosterCalendarEventIcon entry={entry} size="sm" />
                        </span>
                        <span className="min-w-0 truncate">
                          {entry.is_flight ? `${entry.departure}→${entry.arrival}` : entry.activity_type}
                        </span>
                      </div>
                    ))}
                    {item.entries.length > 2 && <span className="text-[8px] sm:text-[9px] text-muted-foreground">+{item.entries.length - 2}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        )}
      </div>

      <Sheet open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[420px] bg-background border-border p-0">
          <SheetHeader className="p-5 border-b border-border">
            <SheetTitle className="text-foreground text-left break-words">
              {selectedDay && `${selectedDay} de ${months[selectedMonth]}`}
            </SheetTitle>
          </SheetHeader>

          <div className="p-4 sm:p-5 overflow-y-auto max-h-[calc(100vh-80px)]">
            <DayDetailContent entries={selectedEntries} monthLabel={months[selectedMonth]} />
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
