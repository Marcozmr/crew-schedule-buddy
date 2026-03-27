/**
 * EscalaX — Schedule Calendar (Premium Light)
 */

import { useMemo, useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PdfImportDialog } from '@/components/PdfImportDialog';
import { useScheduleData } from '@/hooks/useScheduleData';
import { Link } from 'react-router-dom';
import { Calendar, Plane, ChevronLeft, ChevronRight, CalendarClock, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatTimeBR, parseDateBRT } from '@/lib/date-utils';
import { compareScheduleEntries } from '@/lib/schedule-entry-sort';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { buildCrewSituationDisplayFromEntry } from '@/lib/roster/crew-tripulante-display';
import { CrewTripulanteSummary } from '@/components/flight-board/CrewTripulanteSummary';
import {
  RosterCalendarEventIcon,
  getRosterCalendarContainerClass,
  getRosterCalendarCellPillClass,
} from '@/lib/roster/roster-calendar-icons';
import { getRosterEventVisualType } from '@/lib/roster/roster-calendar-visual';

export default function SchedulePage() {
  const { schedule, reload } = useScheduleData();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground break-words">{filteredSchedule.length} registros em {months[selectedMonth]}</p>
            <Link
              to="/minha-escala"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <CalendarClock className="h-3.5 w-3.5" />
              Minha escala — PDF e atualização
            </Link>
          </div>
          <PdfImportDialog onImportComplete={reload} />
        </div>

        <div className="glass px-3 py-2 sm:px-4 sm:py-3 flex items-center justify-between gap-2 min-w-0">
          <button
            onClick={() => setSelectedMonth((month) => Math.max(0, month - 1))}
            className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base sm:text-lg font-semibold text-foreground text-center break-words">
            {months[selectedMonth]} {selectedYear}
          </h2>
          <button
            onClick={() => setSelectedMonth((month) => Math.min(11, month + 1))}
            className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground shrink-0"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

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

              const hasFlights = item.entries.some((entry) => entry.is_flight);
              const isDayOff = item.entries.length > 0 && item.entries.every((entry) => ['DO', 'FOLGA', 'OFF', 'X'].includes(entry.activity_type));
              const isToday = item.day === todayDay;
              const isSelected = item.day === selectedDay;

              return (
                <button
                  key={index}
                  onClick={() => setSelectedDay(item.entries.length > 0 ? item.day : null)}
                  className={`relative min-h-[58px] sm:min-h-[72px] lg:min-h-[88px] rounded-xl p-1 sm:p-1.5 lg:p-2 text-left transition-all duration-150 overflow-hidden ${
                    isSelected
                      ? 'bg-primary/10 ring-2 ring-primary/30'
                      : isToday
                        ? 'bg-primary/5 ring-1 ring-primary/20'
                        : item.entries.length > 0
                          ? 'hover:bg-secondary/80 bg-secondary/40'
                          : 'hover:bg-secondary/50'
                  }`}
                >
                  <span
                    className={`text-[10px] sm:text-xs font-medium ${
                      isToday ? 'text-primary font-bold' : hasFlights ? 'text-foreground' : isDayOff ? 'text-success' : 'text-muted-foreground'
                    }`}
                  >
                    {item.day}
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
      </div>

      <Sheet open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[420px] bg-background border-border p-0">
          <SheetHeader className="p-5 border-b border-border">
            <SheetTitle className="text-foreground text-left break-words">
              {selectedDay && `${selectedDay} de ${months[selectedMonth]}`}
            </SheetTitle>
          </SheetHeader>

          <div className="p-4 sm:p-5 space-y-3 overflow-y-auto max-h-[calc(100vh-80px)]">
            {selectedEntries.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Sem atividades neste dia</p>
              </div>
            ) : (
              selectedEntries.map((entry, index) => {
                const tripCrew = entry.is_flight ? buildCrewSituationDisplayFromEntry(entry) : null;
                return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="glass p-4 min-w-0"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${getRosterCalendarContainerClass(entry)}`}
                    >
                      <RosterCalendarEventIcon entry={entry} size="md" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-semibold text-foreground text-sm break-words">{entry.flight_number}</span>
                        {!entry.is_flight && (
                          <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground whitespace-nowrap">{entry.activity_type}</span>
                        )}
                      </div>

                      {entry.is_flight && (
                        <>
                          <div className="flex items-center gap-2 mt-3 min-w-0">
                            <div className="text-center min-w-[52px]">
                              <p className="text-sm sm:text-base font-bold font-mono text-foreground break-words">
                                {(entry.departure_airport || entry.departure || '---').substring(0, 3).toUpperCase()}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">{formatTimeBR(entry.departure_time)}</p>
                            </div>
                            <div className="flex-1 min-w-0 flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                              <div className="h-px flex-1 bg-border" />
                              <Plane className="w-3 h-3 text-primary shrink-0" />
                              <div className="h-px flex-1 bg-border" />
                              <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                            </div>
                            <div className="text-center min-w-[52px]">
                              <p className="text-sm sm:text-base font-bold font-mono text-foreground break-words">
                                {(entry.arrival_airport || entry.arrival || '---').substring(0, 3).toUpperCase()}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">{formatTimeBR(entry.arrival_time)}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border text-[11px] min-w-0">
                            {entry.report_time && (
                              <span className="text-muted-foreground whitespace-nowrap">
                                Apresent.: <span className="font-mono font-medium text-primary">{formatTimeBR(entry.report_time)}</span>
                              </span>
                            )}
                            {entry.flight_hours != null && (
                              <span className="text-muted-foreground whitespace-nowrap">
                                Voo: <span className="font-mono font-medium text-foreground">{entry.flight_hours}h</span>
                              </span>
                            )}
                            {entry.duty_hours != null && (
                              <span className="text-muted-foreground whitespace-nowrap">
                                Jornada: <span className="font-mono font-medium text-foreground">{entry.duty_hours}h</span>
                              </span>
                            )}
                          </div>
                          {tripCrew && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <CrewTripulanteSummary crew={tripCrew} scheduleEntry={entry} />
                            </div>
                          )}
                        </>
                      )}

                      {!entry.is_flight && getRosterEventVisualType(entry) === 'rest' && (
                        <div className="mt-2 flex min-w-0 items-center gap-2">
                          <RosterCalendarEventIcon entry={entry} size="md" />
                          <span className="break-words text-sm font-medium text-success">
                            Folga / Descanso
                          </span>
                        </div>
                      )}

                      {entry.hotel_name && (
                        <p className="mt-2 flex items-start gap-1.5 break-words text-xs text-muted-foreground">
                          <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span>{entry.hotel_name}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
