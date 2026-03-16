import { useMemo, useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PdfImportDialog } from '@/components/PdfImportDialog';
import { useScheduleData } from '@/hooks/useScheduleData';
import { Calendar, List, Plane, Clock, MapPin, Coffee } from 'lucide-react';
import { motion } from 'framer-motion';

type ViewMode = 'list' | 'calendar';

export default function SchedulePage() {
  const { schedule, reload } = useScheduleData();
  const [view, setView] = useState<ViewMode>('list');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear] = useState(new Date().getFullYear());

  const parseEntryDate = (dateStr: string) => {
    if (dateStr.includes('-') && dateStr.indexOf('-') === 4) return new Date(dateStr + 'T00:00:00');
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length < 3) return new Date();
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  };

  const getDay = (dateStr: string) => parseEntryDate(dateStr).getDate();
  const getMonth = (dateStr: string) => parseEntryDate(dateStr).getMonth();

  useEffect(() => {
    if (schedule.length === 0) return;
    const currentMonth = new Date().getMonth();
    const hasCurrentMonth = schedule.some(e => getMonth(e.date) === currentMonth);
    if (hasCurrentMonth) { setSelectedMonth(currentMonth); return; }
    let latestMonth = -1;
    for (const e of schedule) {
      const m = getMonth(e.date);
      if (m > latestMonth) latestMonth = m;
    }
    if (latestMonth >= 0) setSelectedMonth(latestMonth);
  }, [schedule]);

  const filteredSchedule = useMemo(() => {
    return schedule.filter(e => getMonth(e.date) === selectedMonth);
  }, [schedule, selectedMonth]);

  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    const days: { day: number; entries: typeof schedule }[] = [];
    for (let i = 0; i < firstDay; i++) days.push({ day: 0, entries: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      const entries = filteredSchedule.filter(e => getDay(e.date) === d);
      days.push({ day: d, entries });
    }
    return days;
  }, [filteredSchedule, selectedMonth, selectedYear]);

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  const getActivityIcon = (entry: typeof schedule[0]) => {
    if (entry.is_flight) return <Plane className="w-5 h-5 text-primary" />;
    if (['DO', 'FOLGA', 'OFF', 'X'].includes(entry.activity_type)) return <Coffee className="w-5 h-5 text-success" />;
    return <Clock className="w-5 h-5 text-accent-foreground" />;
  };

  const getActivityBg = (entry: typeof schedule[0]) => {
    if (entry.is_flight) return 'bg-primary/10';
    if (['DO', 'FOLGA', 'OFF', 'X'].includes(entry.activity_type)) return 'bg-success/10';
    return 'bg-muted';
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Minha Escala</h1>
          <p className="text-muted-foreground text-sm">
            {schedule.length} registros • {filteredSchedule.length} em {months[selectedMonth]}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PdfImportDialog onImportComplete={reload} />
          <div className="flex bg-muted rounded-lg p-1">
            <button onClick={() => setView('list')} className={`p-2 rounded-md transition-all ${view === 'list' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}><List className="w-4 h-4" /></button>
            <button onClick={() => setView('calendar')} className={`p-2 rounded-md transition-all ${view === 'calendar' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}><Calendar className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

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

      {view === 'list' ? (
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
                      <MapPin className="w-3 h-3" />
                      {entry.departure_airport || entry.departure} → {entry.arrival_airport || entry.arrival}
                    </p>
                  )}
                  {entry.hotel_name && <p className="text-xs text-muted-foreground mt-0.5">🏨 {entry.hotel_name}</p>}
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div><p className="text-xs text-muted-foreground">Data</p><p className="font-mono text-foreground">{entry.date}</p></div>
                {entry.is_flight && (
                  <>
                    <div><p className="text-xs text-muted-foreground">Horário</p><p className="font-mono text-foreground">{entry.departure_time !== '00:00' ? entry.departure_time : '—'} - {entry.arrival_time !== '00:00' ? entry.arrival_time : '—'}</p></div>
                    {entry.report_time && <div><p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />Aprst</p><p className="font-mono font-medium text-primary">{entry.report_time}</p></div>}
                    {entry.duty_hours != null && <div><p className="text-xs text-muted-foreground">Duty</p><p className="font-mono text-foreground">{entry.duty_hours}h</p></div>}
                    {entry.flight_hours != null && <div><p className="text-xs text-muted-foreground">Voo</p><p className="font-mono text-foreground">{entry.flight_hours}h</p></div>}
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-card p-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
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
