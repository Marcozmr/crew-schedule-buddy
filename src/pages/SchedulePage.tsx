import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useScheduleData } from '@/hooks/useScheduleData';
import { Calendar, List, Plane, Clock, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';

type ViewMode = 'list' | 'calendar';

export default function SchedulePage() {
  const { schedule } = useScheduleData();
  const [view, setView] = useState<ViewMode>('list');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear] = useState(new Date().getFullYear());

  const filteredSchedule = useMemo(() => {
    return schedule.filter(e => {
      const parts = e.date.split(/[\/\-]/);
      if (parts.length < 3) return false;
      return parseInt(parts[1]) - 1 === selectedMonth;
    });
  }, [schedule, selectedMonth]);

  // Lista sempre mostra todos os voos importados do usuário autenticado
  const displaySchedule = useMemo(() => schedule, [schedule]);

  const calendarDays = useMemo(() => {
    const yr = selectedYear;
    const mo = selectedMonth;
    const daysInMonth = new Date(yr, mo + 1, 0).getDate();
    const firstDay = new Date(yr, mo, 1).getDay();
    const days: { day: number; entries: typeof schedule }[] = [];
    for (let i = 0; i < firstDay; i++) days.push({ day: 0, entries: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      const entries = filteredSchedule.filter(e => {
        const parts = e.date.split(/[\/\-]/);
        return parseInt(parts[0]) === d;
      });
      days.push({ day: d, entries });
    }
    return days;
  }, [filteredSchedule, selectedMonth, selectedYear]);

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  const activeMonth = filteredSchedule.length > 0 ? selectedMonth : effectiveMonth;

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Minha Escala</h1>
          <p className="text-muted-foreground text-sm">
            {displaySchedule.length} voos em {months[activeMonth]}
            {schedule.length > 0 && ` • ${schedule.length} total importados`}
          </p>
        </div>
        <div className="flex bg-muted rounded-lg p-1">
          <button onClick={() => setView('list')} className={`p-2 rounded-md transition-all ${view === 'list' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>
            <List className="w-4 h-4" />
          </button>
          <button onClick={() => setView('calendar')} className={`p-2 rounded-md transition-all ${view === 'calendar' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>
            <Calendar className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {months.map((m, i) => (
          <button key={m} onClick={() => setSelectedMonth(i)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${i === selectedMonth ? 'gradient-sky text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted shadow-card'}`}>
            {m}
          </button>
        ))}
      </div>

      {view === 'list' ? (
        <div className="space-y-3">
          {displaySchedule.length === 0 && (
            <div className="bg-card rounded-xl p-12 text-center shadow-card">
              <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum voo neste mês</p>
              <p className="text-xs text-muted-foreground mt-1">Selecione outro mês ou sincronize sua escala no Dashboard.</p>
            </div>
          )}
          {displaySchedule.map((entry, i) => (
            <motion.div key={entry.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="bg-card rounded-xl p-4 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Plane className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{entry.flight_number}</span>
                    {entry.airline && <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{entry.airline}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />{entry.departure} → {entry.arrival}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div><p className="text-xs text-muted-foreground">Data</p><p className="font-mono text-foreground">{entry.date}</p></div>
                <div><p className="text-xs text-muted-foreground">Horário</p><p className="font-mono text-foreground">{entry.departure_time} - {entry.arrival_time}</p></div>
                {entry.report_time && <div><p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />Apresentação</p><p className="font-mono font-medium text-primary">{entry.report_time}</p></div>}
                {entry.duty_hours && <div><p className="text-xs text-muted-foreground">Duty</p><p className="font-mono text-foreground">{entry.duty_hours}h</p></div>}
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
                      <div key={e.id} className="mt-1 bg-primary/10 rounded px-1 py-0.5 text-primary font-mono truncate" title={`${e.flight_number} ${e.departure}-${e.arrival}`}>
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
