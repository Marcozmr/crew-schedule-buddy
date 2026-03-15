import { useMemo, useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { StatCard } from '@/components/StatCard';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Clock, CalendarDays, Plane, Coffee, AlertCircle, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

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

export default function DashboardPage() {
  const { profile } = useAuth();
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);

  const loadSchedule = async () => {
    const { data } = await supabase.from('schedule_entries').select('*').order('date', { ascending: true });
    if (data) setSchedule(data as ScheduleEntry[]);
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  // Refetch when page gains focus (e.g. after navigating back from upload)
  useEffect(() => {
    const handleFocus = () => loadSchedule();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') loadSchedule();
    });
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const daysInMonth = new Date(now.getFullYear(), currentMonth + 1, 0).getDate();

    const monthEntries = schedule.filter(e => {
      const parts = e.date.split(/[\/\-]/);
      if (parts.length < 3) return false;
      return parseInt(parts[1]) - 1 === currentMonth;
    });

    const totalHours = monthEntries.reduce((sum, e) => sum + (e.duty_hours || 0), 0);
    const flightDays = new Set(monthEntries.map(e => e.date)).size;
    const daysOff = daysInMonth - flightDays;

    const sorted = [...monthEntries].sort((a, b) => {
      const dateA = new Date(a.date.split(/[\/\-]/).reverse().join('-'));
      const dateB = new Date(b.date.split(/[\/\-]/).reverse().join('-'));
      return dateA.getTime() - dateB.getTime();
    });

    const nextFlight = sorted.find(e => {
      const parts = e.date.split(/[\/\-]/);
      const entryDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      return entryDate >= now;
    });

    return { totalFlights: monthEntries.length, totalHours: Math.round(totalHours * 10) / 10, daysOff, flightDays, nextFlight, maxHours: 85 };
  }, [schedule]);

  const hoursPercentage = Math.min((stats.totalHours / stats.maxHours) * 100, 100);

  return (
    <AppLayout>
      <div className="mb-8">
        <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl md:text-3xl font-bold text-foreground">
          Olá, {profile?.name || 'Tripulante'} ✈️
        </motion.h1>
        <p className="text-muted-foreground mt-1">{profile?.airline ? `${profile.airline} • ` : ''}Resumo do mês atual</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Voos no mês" value={stats.totalFlights} icon={Plane} variant="primary" />
        <StatCard title="Horas voadas" value={`${stats.totalHours}h`} subtitle={`de ${stats.maxHours}h permitidas`} icon={Clock} />
        <StatCard title="Dias de folga" value={stats.daysOff} icon={Coffee} variant="accent" />
        <StatCard title="Dias de voo" value={stats.flightDays} icon={CalendarDays} />
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-xl p-6 shadow-card mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Horas do Mês</h2>
          </div>
          <span className="text-sm font-mono text-muted-foreground">{stats.totalHours}h / {stats.maxHours}h</span>
        </div>
        <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${hoursPercentage}%` }} transition={{ duration: 1, ease: 'easeOut' }} className={`h-full rounded-full ${hoursPercentage > 90 ? 'bg-destructive' : 'gradient-sky'}`} />
        </div>
        {hoursPercentage > 80 && (
          <div className="flex items-center gap-2 mt-3 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Atenção: próximo do limite de horas mensais</span>
          </div>
        )}
      </motion.div>

      {stats.nextFlight && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card rounded-xl p-6 shadow-card mb-8">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Plane className="w-5 h-5 text-primary" />
            Próximo Voo
          </h2>
          <div className="flex flex-wrap items-center gap-6">
            <div><p className="text-xs text-muted-foreground">Data</p><p className="font-bold text-foreground">{stats.nextFlight.date}</p></div>
            <div><p className="text-xs text-muted-foreground">Voo</p><p className="font-bold text-foreground">{stats.nextFlight.flight_number}</p></div>
            <div><p className="text-xs text-muted-foreground">Rota</p><p className="font-bold text-foreground">{stats.nextFlight.departure} → {stats.nextFlight.arrival}</p></div>
            <div><p className="text-xs text-muted-foreground">Apresentação</p><p className="font-bold text-primary">{stats.nextFlight.report_time || stats.nextFlight.departure_time}</p></div>
            <div><p className="text-xs text-muted-foreground">Duty</p><p className="font-bold text-foreground">{stats.nextFlight.duty_hours}h</p></div>
          </div>
        </motion.div>
      )}

      {schedule.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-card rounded-xl p-6 shadow-card">
          <h2 className="font-semibold text-foreground mb-4">Últimos voos da escala</h2>
          <div className="space-y-3">
            {schedule.slice(-5).reverse().map(entry => (
              <div key={entry.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Plane className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">{entry.flight_number}</p>
                    <p className="text-xs text-muted-foreground">{entry.departure} → {entry.arrival}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-foreground">{entry.date}</p>
                  <p className="text-xs text-muted-foreground">{entry.departure_time} - {entry.arrival_time}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {schedule.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl p-12 shadow-card text-center">
          <Plane className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-foreground mb-2">Nenhuma escala importada</h3>
          <p className="text-sm text-muted-foreground">Importe sua escala na aba "Importar" para ver seus dados aqui.</p>
        </motion.div>
      )}
    </AppLayout>
  );
}
