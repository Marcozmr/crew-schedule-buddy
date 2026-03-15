import { useState, useMemo, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, List, Plane, Clock, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';

interface ScheduleEntry {
  id: string;
  date: string;
  flight_number: string;
  departure: string;
  arrival: string;
  departure_time: string;
  arrival_time: string;
  status: string;
  airline: string | null;
  report_time: string | null;
  duty_hours: number | null;
}

type ViewMode = 'list' | 'calendar';

export default function SchedulePage() {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [view, setView] = useState<ViewMode>('list');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setSchedule([]);
        return;
      }

      const { data } = await supabase
        .from('schedule_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('date');

      if (data) setSchedule(data as ScheduleEntry[]);
    };

    void load();
  }, [user]);

  const filteredSchedule = useMemo(() => {
    return schedule.filter(e => {
      const parts = e.date.split(/[\/\-]/);
      if (parts.length < 3) return false;
      return parseInt(parts[1]) - 1 === selectedMonth;
    });
  }, [schedule, selectedMonth]);

  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    const days: { day: number; entries: ScheduleEntry[] }[] = [];
    for (let i = 0; i < firstDay; i++) days.push({ day: 0, entries: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      const entries = schedule.filter(e => {
        const parts = e.date.split(/[\/\-]/);
        return parseInt(parts[0]) === d && parseInt(parts[1]) === selectedMonth + 1;
      });
      days.push({ day: d, entries });
    }
    return days;
  }, [schedule, selectedMonth, selectedYear]);

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Minha Escala</h1>
          <p className="text-muted-foreground text-sm">{filteredSchedule.length} voos em {months[selectedMonth]}</p>
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
          {filteredSchedule.length === 0 && (
            <div className="bg-card rounded-xl p-12 text-center shadow-card">
              <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum voo neste mês</p>
            </div>
          )}
          {filteredSchedule.map((entry, i) => (
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
