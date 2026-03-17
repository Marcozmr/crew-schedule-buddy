/**
 * EscalaX — Schedule Calendar (Premium Light)
 */

import { useMemo, useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PdfImportDialog } from '@/components/PdfImportDialog';
import { useScheduleData } from '@/hooks/useScheduleData';
import { Calendar, Plane, Clock, Coffee, BedDouble, AlertTriangle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDateBR, formatTimeBR, parseDateBRT } from '@/lib/date-utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

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
    const hasCurrentMonth = schedule.some(e => getMonth(e.date) === currentMonth);
    if (hasCurrentMonth) { setSelectedMonth(currentMonth); return; }
    let latestMonth = -1;
    for (const e of schedule) { const m = getMonth(e.date); if (m > latestMonth) latestMonth = m; }
    if (latestMonth >= 0) setSelectedMonth(latestMonth);
  }, [schedule]);

  const filteredSchedule = useMemo(() =>
    schedule.filter(e => getMonth(e.date) === selectedMonth), [schedule, selectedMonth]);

  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    const days: { day: number; entries: typeof schedule }[] = [];
    for (let i = 0; i < firstDay; i++) days.push({ day: 0, entries: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, entries: filteredSchedule.filter(e => getDay(e.date) === d) });
    }
    return days;
  }, [filteredSchedule, selectedMonth, selectedYear]);

  const todayDay = new Date().getMonth() === selectedMonth ? new Date().getDate() : -1;
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const selectedEntries = useMemo(() => {
    if (!selectedDay) return [];
    return filteredSchedule
      .filter(e => getDay(e.date) === selectedDay)
      .sort((a, b) => (a.departure_time || '').localeCompare(b.departure_time || ''));
  }, [filteredSchedule, selectedDay]);

  const getActivityIcon = (entry: typeof schedule[0]) => {
    if (entry.is_flight) return <Plane className="w-4 h-4 text-primary" />;
    if (['DO', 'FOLGA', 'OFF', 'X'].includes(entry.activity_type)) return <Coffee className="w-4 h-4 text-success" />;
    if (['HSB', 'HSBE', 'ASB'].includes(entry.activity_type)) return <Clock className="w-4 h-4 text-warning" />;
    return <Clock className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-muted-foreground">{filteredSchedule.length} registros em {months[selectedMonth]}</p>
        </div>
        <PdfImportDialog onImportComplete={reload} />
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setSelectedMonth(m => Math.max(0, m - 1))}
          className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-foreground">
          {months[selectedMonth]} {selectedYear}
        </h2>
        <button onClick={() => setSelectedMonth(m => Math.min(11, m + 1))}
          className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="glass p-4 lg:p-6">
        {/* Week headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((item, i) => {
            if (item.day === 0) return <div key={i} />;

            const hasFlights = item.entries.some(e => e.is_flight);
            const isDayOff = item.entries.length > 0 && item.entries.every(e => ['DO', 'FOLGA', 'OFF', 'X'].includes(e.activity_type));
            const isToday = item.day === todayDay;
            const isSelected = item.day === selectedDay;

            return (
              <button
                key={i}
                onClick={() => setSelectedDay(item.entries.length > 0 ? item.day : null)}
                className={`
                  relative min-h-[72px] lg:min-h-[88px] rounded-xl p-1.5 lg:p-2 text-left transition-all duration-150
                  ${isSelected ? 'bg-primary/10 ring-2 ring-primary/30' :
                    isToday ? 'bg-primary/5 ring-1 ring-primary/20' :
                    item.entries.length > 0 ? 'hover:bg-secondary/80 bg-secondary/40' : 'hover:bg-secondary/50'}
                `}
              >
                <span className={`text-xs font-medium ${
                  isToday ? 'text-primary font-bold' :
                  hasFlights ? 'text-foreground' :
                  isDayOff ? 'text-success' : 'text-muted-foreground'
                }`}>
                  {item.day}
                </span>

                <div className="mt-1 space-y-0.5">
                  {item.entries.slice(0, 3).map(e => (
                    <div key={e.id} className={`rounded px-1 py-0.5 text-[9px] lg:text-[10px] font-mono truncate ${
                      e.is_flight ? 'bg-primary/10 text-primary font-medium' :
                      ['DO', 'FOLGA', 'OFF', 'X'].includes(e.activity_type) ? 'bg-success/10 text-success' :
                      'bg-warning/10 text-warning'
                    }`}>
                      {e.is_flight ? `${e.departure}→${e.arrival}` : e.activity_type}
                    </div>
                  ))}
                  {item.entries.length > 3 && (
                    <span className="text-[9px] text-muted-foreground">+{item.entries.length - 3}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day Detail Sheet */}
      <Sheet open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <SheetContent side="right" className="w-full sm:w-[420px] bg-background border-border p-0">
          <SheetHeader className="p-5 border-b border-border">
            <SheetTitle className="text-foreground text-left">
              {selectedDay && `${selectedDay} de ${months[selectedMonth]}`}
            </SheetTitle>
          </SheetHeader>

          <div className="p-5 space-y-3 overflow-y-auto max-h-[calc(100vh-80px)]">
            {selectedEntries.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Sem atividades neste dia</p>
              </div>
            ) : (
              selectedEntries.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      entry.is_flight ? 'bg-primary/10' :
                      ['DO', 'FOLGA', 'OFF', 'X'].includes(entry.activity_type) ? 'bg-success/10' : 'bg-warning/10'
                    }`}>
                      {getActivityIcon(entry)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">{entry.flight_number}</span>
                        {!entry.is_flight && (
                          <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{entry.activity_type}</span>
                        )}
                      </div>

                      {entry.is_flight && (
                        <>
                          {/* Route */}
                          <div className="flex items-center gap-2 mt-3">
                            <div className="text-center">
                              <p className="text-base font-bold font-mono text-foreground">{(entry.departure_airport || entry.departure || '---').substring(0, 3).toUpperCase()}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{formatTimeBR(entry.departure_time)}</p>
                            </div>
                            <div className="flex-1 flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                              <div className="h-px flex-1 bg-border" />
                              <Plane className="w-3 h-3 text-primary" />
                              <div className="h-px flex-1 bg-border" />
                              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                            </div>
                            <div className="text-center">
                              <p className="text-base font-bold font-mono text-foreground">{(entry.arrival_airport || entry.arrival || '---').substring(0, 3).toUpperCase()}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{formatTimeBR(entry.arrival_time)}</p>
                            </div>
                          </div>

                          {/* Details */}
                          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border text-[11px]">
                            {entry.report_time && (
                              <span className="text-muted-foreground">
                                Aprst: <span className="font-mono font-medium text-primary">{formatTimeBR(entry.report_time)}</span>
                              </span>
                            )}
                            {entry.flight_hours != null && (
                              <span className="text-muted-foreground">Voo: <span className="font-mono font-medium text-foreground">{entry.flight_hours}h</span></span>
                            )}
                            {entry.duty_hours != null && (
                              <span className="text-muted-foreground">Jornada: <span className="font-mono font-medium text-foreground">{entry.duty_hours}h</span></span>
                            )}
                          </div>
                        </>
                      )}

                      {!entry.is_flight && ['DO', 'FOLGA', 'OFF', 'X'].includes(entry.activity_type) && (
                        <div className="flex items-center gap-2 mt-2">
                          <BedDouble className="w-4 h-4 text-success" />
                          <span className="text-sm text-success font-medium">Folga / Descanso</span>
                        </div>
                      )}

                      {entry.hotel_name && (
                        <p className="text-xs text-muted-foreground mt-2">🏨 {entry.hotel_name}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
