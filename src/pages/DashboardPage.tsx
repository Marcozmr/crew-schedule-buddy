import { useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { StatCard } from '@/components/StatCard';
import { getSchedule, getUser } from '@/lib/store';
import { Clock, CalendarDays, Plane, Coffee, AlertCircle, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { ScheduleEntry } from '@/lib/types';

export default function DashboardPage() {
  const user = getUser();
  const schedule = getSchedule();

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const monthEntries = schedule.filter(e => {
      const parts = e.date.split(/[\/\-]/);
      if (parts.length < 3) return false;
      const month = parseInt(parts[1]) - 1;
      return month === currentMonth;
    });

    const totalHours = monthEntries.reduce((sum, e) => sum + (e.dutyHours || 0), 0);
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

    return {
      totalFlights: monthEntries.length,
      totalHours: Math.round(totalHours * 10) / 10,
      daysOff,
      flightDays,
      nextFlight,
      maxHours: 85,
    };
  }, [schedule]);

  const hoursPercentage = Math.min((stats.totalHours / stats.maxHours) * 100, 100);

  return (
    <AppLayout>
      <div className="mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl md:text-3xl font-bold text-foreground"
        >
          Olá, {user?.name || 'Tripulante'} ✈️
        </motion.h1>
        <p className="text-muted-foreground mt-1">
          {user?.airline ? `${user.airline} • ` : ''}Resumo do mês atual
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Voos no mês" value={stats.totalFlights} icon={Plane} variant="primary" />
        <StatCard title="Horas voadas" value={`${stats.totalHours}h`} subtitle={`de ${stats.maxHours}h permitidas`} icon={Clock} />
        <StatCard title="Dias de folga" value={stats.daysOff} icon={Coffee} variant="accent" />
        <StatCard title="Dias de voo" value={stats.flightDays} icon={CalendarDays} />
      </div>

      {/* Hours Progress */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-xl p-6 shadow-card mb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Horas do Mês</h2>
          </div>
          <span className="text-sm font-mono text-muted-foreground">{stats.totalHours}h / {stats.maxHours}h</span>
        </div>
        <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${hoursPercentage}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className={`h-full rounded-full ${hoursPercentage > 90 ? 'bg-destructive' : 'gradient-sky'}`}
          />
        </div>
        {hoursPercentage > 80 && (
          <div className="flex items-center gap-2 mt-3 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Atenção: próximo do limite de horas mensais</span>
          </div>
        )}
      </motion.div>

      {/* Next Flight */}
      {stats.nextFlight && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-xl p-6 shadow-card mb-8"
        >
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Plane className="w-5 h-5 text-primary" />
            Próximo Voo
          </h2>
          <NextFlightInfo flight={stats.nextFlight} />
        </motion.div>
      )}

      {/* Recent Schedule */}
      {schedule.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card rounded-xl p-6 shadow-card"
        >
          <h2 className="font-semibold text-foreground mb-4">Últimos voos da escala</h2>
          <div className="space-y-3">
            {schedule.slice(-5).reverse().map(entry => (
              <div key={entry.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Plane className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">{entry.flightNumber}</p>
                    <p className="text-xs text-muted-foreground">{entry.departure} → {entry.arrival}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-foreground">{entry.date}</p>
                  <p className="text-xs text-muted-foreground">{entry.departureTime} - {entry.arrivalTime}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {schedule.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card rounded-xl p-12 shadow-card text-center"
        >
          <Plane className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-foreground mb-2">Nenhuma escala importada</h3>
          <p className="text-sm text-muted-foreground">Importe sua escala na aba "Importar" para ver seus dados aqui.</p>
        </motion.div>
      )}
    </AppLayout>
  );
}

function NextFlightInfo({ flight }: { flight: ScheduleEntry }) {
  return (
    <div className="flex items-center gap-6">
      <div>
        <p className="text-xs text-muted-foreground">Data</p>
        <p className="font-bold text-foreground">{flight.date}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Voo</p>
        <p className="font-bold text-foreground">{flight.flightNumber}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Rota</p>
        <p className="font-bold text-foreground">{flight.departure} → {flight.arrival}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Apresentação</p>
        <p className="font-bold text-primary">{flight.reportTime || flight.departureTime}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Duty</p>
        <p className="font-bold text-foreground">{flight.dutyHours}h</p>
      </div>
    </div>
  );
}
