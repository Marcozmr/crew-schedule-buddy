import { useMemo, useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PdfImportDialog } from '@/components/PdfImportDialog';
import { useScheduleData } from '@/hooks/useScheduleData';
import { Calendar, List, Plane, Clock, MapPin, Coffee, ChevronLeft, ChevronRight, BedDouble, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDateBR, formatTimeBR, parseDateBRT } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';

type ViewMode = 'daily' | 'list' | 'calendar';

interface DayGroup {
  date: string;
  dateObj: Date;
  entries: ReturnType<typeof useScheduleData>['schedule'];
  isToday: boolean;
  totalFlightH: number;
  totalDutyH: number;
  isDayOff: boolean;
}

export default function SchedulePage() {
  const { schedule, reload } = useScheduleData();
  const [view, setView] = useState<ViewMode>('daily');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear] = useState(new Date().getFullYear());
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const dayScrollRef = useRef<HTMLDivElement>(null);

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

  const filteredSchedule = useMemo(() => schedule.filter(e => getMonth(e.date) === selectedMonth), [schedule, selectedMonth]);

  // Group by day for daily view
  const dayGroups = useMemo((): DayGroup[] => {
    const map = new Map<string, typeof schedule>();
    for (const e of filteredSchedule) {
      const arr = map.get(e.date) || [];
      arr.push(e);
      map.set(e.date, arr);
    }
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, entries]) => {
        const flights = entries.filter(e => e.is_flight);
        const isDayOff = entries.every(e => ['DO', 'FOLGA', 'OFF', 'X'].includes(e.activity_type));
        return {
          date,
          dateObj: parseDateBRT(date),
          entries: entries.sort((a, b) => (a.departure_time || '').localeCompare(b.departure_time || '')),
          isToday: date === todayStr,
          totalFlightH: flights.reduce((s, e) => s + (e.flight_hours || 0), 0),
          totalDutyH: flights.reduce((s, e) => s + (e.duty_hours || 0), 0),
          isDayOff,
        };
      });
  }, [filteredSchedule]);

  // Auto-select today or first day
  useEffect(() => {
    if (dayGroups.length === 0) return;
    const todayIdx = dayGroups.findIndex(d => d.isToday);
    setSelectedDayIdx(todayIdx >= 0 ? todayIdx : 0);
  }, [dayGroups]);

  // Scroll selected day into view
  useEffect(() => {
    if (!dayScrollRef.current) return;
    const child = dayScrollRef.current.children[selectedDayIdx] as HTMLElement;
    if (child) child.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedDayIdx]);

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

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const getActivityIcon = (entry: typeof schedule[0]) => {
    if (entry.is_flight) return <Plane className="w-5 h-5 text-primary" />;
    if (['DO', 'FOLGA', 'OFF', 'X'].includes(entry.activity_type)) return <Coffee className="w-5 h-5 text-success" />;
    if (['HSB', 'HSBE', 'ASB'].includes(entry.activity_type)) return <Clock className="w-5 h-5 text-warning" />;
    if (['RSV'].includes(entry.activity_type)) return <AlertTriangle className="w-5 h-5 text-accent" />;
    return <Clock className="w-5 h-5 text-muted-foreground" />;
  };

  const getActivityBg = (entry: typeof schedule[0]) => {
    if (entry.is_flight) return 'bg-primary/10';
    if (['DO', 'FOLGA', 'OFF', 'X'].includes(entry.activity_type)) return 'bg-success/10';
    if (['HSB', 'HSBE', 'ASB'].includes(entry.activity_type)) return 'bg-warning/10';
    return 'bg-muted';
  };

  const currentDay = dayGroups[selectedDayIdx] || null;

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-muted-foreground text-sm">{schedule.length} registros • {filteredSchedule.length} em {months[selectedMonth]}</p>
        </div>
        <div className="flex items-center gap-3">
          <PdfImportDialog onImportComplete={reload} />
          <div className="flex bg-muted rounded-lg p-1">
            <button onClick={() => setView('daily')} className={`p-2 rounded-md transition-all text-xs font-medium ${view === 'daily' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>Dia</button>
            <button onClick={() => setView('list')} className={`p-2 rounded-md transition-all ${view === 'list' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}><List className="w-4 h-4" /></button>
            <button onClick={() => setView('calendar')} className={`p-2 rounded-md transition-all ${view === 'calendar' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}><Calendar className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {months.map((m, i) => {
          const hasData = schedule.some(e => getMonth(e.date) === i);
          return (
            <button key={m} onClick={() => setSelectedMonth(i)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${i === selectedMonth ? 'gradient-sky text-primary-foreground' : hasData ? 'bg-card text-foreground hover:bg-muted shadow-card' : 'bg-card text-muted-foreground hover:bg-muted shadow-card'}`}>
              {m}{hasData && i !== selectedMonth && <span className="ml-1 text-xs">•</span>}
            </button>
          );
        })}
      </div>

      {/* DAILY VIEW */}
      {view === 'daily' && (
        <div className="space-y-4">
          {dayGroups.length === 0 ? (
            <div className="bg-card rounded-xl p-12 text-center shadow-card">
              <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum registro em {months[selectedMonth]}</p>
            </div>
          ) : (
            <>
              {/* Day selector - horizontal scroll */}
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedDayIdx(Math.max(0, selectedDayIdx - 1))} disabled={selectedDayIdx === 0} className="p-1.5 rounded-lg bg-card shadow-card disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4 text-foreground" />
                </button>
                <div ref={dayScrollRef} className="flex-1 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {dayGroups.map((day, idx) => (
                    <button
                      key={day.date}
                      onClick={() => setSelectedDayIdx(idx)}
                      className={`flex flex-col items-center min-w-[52px] px-2 py-2 rounded-xl transition-all shrink-0 ${
                        idx === selectedDayIdx
                          ? 'gradient-sky text-primary-foreground shadow-glow-blue'
                          : day.isToday
                          ? 'bg-primary/10 border border-primary/30 text-foreground'
                          : day.isDayOff
                          ? 'bg-success/5 text-success'
                          : 'bg-card text-foreground shadow-card'
                      }`}
                    >
                      <span className="text-[9px] font-medium uppercase">{weekDays[day.dateObj.getDay()]}</span>
                      <span className="text-lg font-bold font-mono leading-tight">{day.dateObj.getDate()}</span>
                      <span className="text-[9px]">
                        {day.isDayOff ? 'OFF' : `${day.entries.filter(e => e.is_flight).length}v`}
                      </span>
                    </button>
                  ))}
                </div>
                <button onClick={() => setSelectedDayIdx(Math.min(dayGroups.length - 1, selectedDayIdx + 1))} disabled={selectedDayIdx >= dayGroups.length - 1} className="p-1.5 rounded-lg bg-card shadow-card disabled:opacity-30">
                  <ChevronRight className="w-4 h-4 text-foreground" />
                </button>
              </div>

              {/* Selected day detail */}
              {currentDay && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentDay.date}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    {/* Day header card */}
                    <div className="glass rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-lg font-bold text-foreground">{formatDateBR(currentDay.date)}</p>
                          <p className="text-xs text-muted-foreground">
                            {currentDay.isDayOff ? 'Folga / Descanso' : `${currentDay.entries.filter(e => e.is_flight).length} voo(s)`}
                          </p>
                        </div>
                        {currentDay.isToday && (
                          <span className="px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-[10px] font-bold uppercase text-primary">Hoje</span>
                        )}
                      </div>

                      {/* Day stats */}
                      {!currentDay.isDayOff && (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-lg bg-secondary/40 px-3 py-2 text-center">
                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Voos</p>
                            <p className="text-sm font-bold font-mono text-foreground">{currentDay.entries.filter(e => e.is_flight).length}</p>
                          </div>
                          <div className="rounded-lg bg-secondary/40 px-3 py-2 text-center">
                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">H. Voo</p>
                            <p className="text-sm font-bold font-mono text-foreground">{Math.round(currentDay.totalFlightH * 10) / 10}h</p>
                          </div>
                          <div className="rounded-lg bg-secondary/40 px-3 py-2 text-center">
                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Jornada</p>
                            <p className="text-sm font-bold font-mono text-foreground">{Math.round(currentDay.totalDutyH * 10) / 10}h</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Entries for the day */}
                    {currentDay.entries.map((entry, i) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-card rounded-xl p-4 shadow-card"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg ${getActivityBg(entry)} flex items-center justify-center shrink-0 mt-0.5`}>
                            {getActivityIcon(entry)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-foreground">{entry.flight_number}</span>
                              {!entry.is_flight && <span className="text-xs bg-accent/20 px-2 py-0.5 rounded-full text-accent-foreground">{entry.activity_type}</span>}
                              {entry.aircraft_type && <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{entry.aircraft_type}</span>}
                            </div>

                            {entry.is_flight && (
                              <>
                                {/* Route */}
                                <div className="flex items-center gap-2 mt-2">
                                  <div className="text-center">
                                    <p className="text-sm font-bold font-mono text-foreground">{(entry.departure_airport || entry.departure || '---').substring(0, 3).toUpperCase()}</p>
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
                                    <p className="text-sm font-bold font-mono text-foreground">{(entry.arrival_airport || entry.arrival || '---').substring(0, 3).toUpperCase()}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono">{formatTimeBR(entry.arrival_time)}</p>
                                  </div>
                                </div>

                                {/* Flight details */}
                                <div className="flex flex-wrap gap-3 mt-2 text-[10px]">
                                  {entry.report_time && (
                                    <span className="text-muted-foreground">
                                      <Clock className="w-3 h-3 inline mr-0.5" />Aprst: <span className="font-mono font-medium text-primary">{formatTimeBR(entry.report_time)}</span>
                                    </span>
                                  )}
                                  {entry.flight_hours != null && (
                                    <span className="text-muted-foreground">Voo: <span className="font-mono font-medium text-foreground">{entry.flight_hours}h</span></span>
                                  )}
                                  {entry.duty_hours != null && (
                                    <span className="text-muted-foreground">Duty: <span className="font-mono font-medium text-foreground">{entry.duty_hours}h</span></span>
                                  )}
                                </div>
                              </>
                            )}

                            {entry.hotel_name && <p className="text-xs text-muted-foreground mt-1">🏨 {entry.hotel_name}</p>}

                            {/* Day off display */}
                            {!entry.is_flight && ['DO', 'FOLGA', 'OFF', 'X'].includes(entry.activity_type) && (
                              <div className="flex items-center gap-2 mt-2">
                                <BedDouble className="w-4 h-4 text-success" />
                                <span className="text-sm text-success font-medium">Dia de folga / descanso</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              )}
            </>
          )}
        </div>
      )}

      {/* LIST VIEW */}
      {view === 'list' && (
        <div className="space-y-3">
          {filteredSchedule.length === 0 && (
            <div className="bg-card rounded-xl p-12 text-center shadow-card">
              <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum registro em {months[selectedMonth]}</p>
            </div>
          )}
          {filteredSchedule.map((entry, i) => (
            <motion.div key={entry.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
              className="bg-card rounded-xl p-4 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${getActivityBg(entry)} flex items-center justify-center shrink-0`}>
                  {getActivityIcon(entry)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{entry.flight_number}</span>
                    {!entry.is_flight && <span className="text-xs bg-accent/20 px-2 py-0.5 rounded-full text-accent-foreground">{entry.activity_type}</span>}
                    {entry.aircraft_type && <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{entry.aircraft_type}</span>}
                  </div>
                  {entry.is_flight && (entry.departure_airport || entry.departure) && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />{entry.departure_airport || entry.departure} → {entry.arrival_airport || entry.arrival}
                    </p>
                  )}
                  {entry.hotel_name && <p className="text-xs text-muted-foreground mt-0.5">🏨 {entry.hotel_name}</p>}
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div><p className="text-xs text-muted-foreground">Data</p><p className="font-mono text-foreground">{formatDateBR(entry.date)}</p></div>
                {entry.is_flight && (
                  <>
                    <div><p className="text-xs text-muted-foreground">Horário</p><p className="font-mono text-foreground">{formatTimeBR(entry.departure_time)} - {formatTimeBR(entry.arrival_time)}</p></div>
                    {entry.report_time && <div><p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />Aprst</p><p className="font-mono font-medium text-primary">{formatTimeBR(entry.report_time)}</p></div>}
                    {entry.duty_hours != null && <div><p className="text-xs text-muted-foreground">Duty</p><p className="font-mono text-foreground">{entry.duty_hours}h</p></div>}
                    {entry.flight_hours != null && <div><p className="text-xs text-muted-foreground">Voo</p><p className="font-mono text-foreground">{entry.flight_hours}h</p></div>}
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* CALENDAR VIEW */}
      {view === 'calendar' && (
        <div className="bg-card rounded-xl shadow-card p-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((item, i) => (
              <div key={i} className={`min-h-[80px] rounded-lg p-1.5 text-xs ${item.day === 0 ? '' : item.entries.length > 0 ? 'bg-primary/5 border border-primary/20' : 'bg-muted/50'}`}>
                {item.day > 0 && (
                  <>
                    <span className={`font-medium ${item.entries.length > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{item.day}</span>
                    {item.entries.map(e => (
                      <div key={e.id} className={`mt-1 rounded px-1 py-0.5 font-mono truncate text-[10px] ${e.is_flight ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'}`} title={`${e.flight_number} ${e.departure_airport || e.departure}-${e.arrival_airport || e.arrival}`}>
                        {e.flight_number}
                      </div>
                    ))}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
