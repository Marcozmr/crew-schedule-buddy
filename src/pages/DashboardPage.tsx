import { useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { StatCard } from '@/components/StatCard';
import { PdfImportDialog } from '@/components/PdfImportDialog';
import { ImportHistoryCard } from '@/components/ImportHistoryCard';
import { useAuth } from '@/lib/auth-context';
import { useScheduleData } from '@/hooks/useScheduleData';
import { Clock, CalendarDays, Plane, Coffee, TrendingUp, Upload, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { formatDateBR, formatTimeBR, parseDateBRT } from '@/lib/date-utils';

export default function DashboardPage() {
  const { profile } = useAuth();
  const { schedule, loading, reload } = useScheduleData();

  const flights = useMemo(() => schedule.filter(e => e.is_flight), [schedule]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const monthEntries = flights.filter(e => {
      const d = parseDateBRT(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const totalFlightHours = monthEntries.reduce((sum, e) => sum + (e.flight_hours || 0), 0);
    const flightDays = new Set(monthEntries.map(e => e.date)).size;
    const daysOff = daysInMonth - flightDays;
    const sorted = [...monthEntries].sort((a, b) => parseDateBRT(a.date).getTime() - parseDateBRT(b.date).getTime());
    const nextFlight = sorted.find(e => parseDateBRT(e.date).getTime() >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime());
    return { totalFlights: monthEntries.length, totalHours: Math.round(totalFlightHours * 10) / 10, daysOff, flightDays, nextFlight, maxHours: 85 };
  }, [flights]);

  const hoursPercentage = Math.min((stats.totalHours / stats.maxHours) * 100, 100);

  const displayFlights = useMemo(() => {
    const now = new Date();
    const monthFlights = flights.filter(e => {
      const d = parseDateBRT(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    return monthFlights.length > 0 ? monthFlights : flights.slice(-20);
  }, [flights]);

  return (
    <AppLayout>
      <div className="mb-6">
        <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl md:text-3xl font-bold text-foreground">
          Olá, {profile?.name || 'Tripulante'} ✈️
        </motion.h1>
        <p className="text-muted-foreground mt-1">{profile?.airline ? `${profile.airline} • ` : ''}Resumo do mês atual</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <PdfImportDialog onImportComplete={reload} />
        <Link to="/schedule"><Button variant="outline"><CalendarDays className="w-4 h-4 mr-2" />Ver Escala</Button></Link>
      </div>

      {!loading && schedule.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-10 shadow-card mb-6 text-center">
          <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-2">Nenhuma escala importada</h2>
          <p className="text-muted-foreground text-sm mb-4">Clique em <strong>"Importar Escala PDF"</strong> para começar.</p>
          <PdfImportDialog onImportComplete={reload} trigger={<Button className="gradient-sky text-primary-foreground"><Upload className="w-4 h-4 mr-2" />Importar meu primeiro PDF</Button>} />
        </motion.div>
      )}

      {schedule.length > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard title="Voos no mês" value={stats.totalFlights} icon={Plane} variant="primary" />
            <StatCard title="Horas voadas" value={`${stats.totalHours}h`} subtitle={`de ${stats.maxHours}h`} icon={Clock} />
            <StatCard title="Dias de folga" value={stats.daysOff} icon={Coffee} variant="accent" />
            <StatCard title="Dias de voo" value={stats.flightDays} icon={CalendarDays} />
          </div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl p-6 shadow-card mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" /><h2 className="font-semibold text-foreground">Horas do Mês</h2></div>
              <span className="text-sm font-mono text-muted-foreground">{stats.totalHours}h / {stats.maxHours}h</span>
            </div>
            <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${hoursPercentage}%` }} transition={{ duration: 1 }} className={`h-full rounded-full ${hoursPercentage > 90 ? 'bg-destructive' : hoursPercentage > 75 ? 'bg-yellow-500' : 'gradient-sky'}`} />
            </div>
          </motion.div>

          {stats.nextFlight && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-xl p-6 shadow-card mb-6">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Plane className="w-5 h-5 text-primary" />Próximo Voo</h2>
              <div className="flex flex-wrap items-center gap-6">
                <div><p className="text-xs text-muted-foreground">Data</p><p className="font-bold text-foreground">{formatDateBR(stats.nextFlight.date)}</p></div>
                <div><p className="text-xs text-muted-foreground">Voo</p><p className="font-bold text-foreground">{stats.nextFlight.flight_number}</p></div>
                <div><p className="text-xs text-muted-foreground">Rota</p><p className="font-bold text-foreground">{stats.nextFlight.departure_airport || stats.nextFlight.departure} → {stats.nextFlight.arrival_airport || stats.nextFlight.arrival}</p></div>
                <div><p className="text-xs text-muted-foreground">Apresentação</p><p className="font-bold text-primary">{formatTimeBR(stats.nextFlight.report_time || stats.nextFlight.departure_time)}</p></div>
              </div>
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card rounded-xl p-6 shadow-card mb-6">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Plane className="w-5 h-5 text-primary" />Voos ({displayFlights.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground text-xs">
                    <th className="py-2 pr-3">Data</th><th className="py-2 pr-3">Voo</th><th className="py-2 pr-3">Origem</th><th className="py-2 pr-3">Destino</th><th className="py-2 pr-3">Saída</th><th className="py-2 pr-3">Chegada</th><th className="py-2 pr-3">Aeronave</th><th className="py-2">Jornada</th>
                  </tr>
                </thead>
                <tbody>
                  {displayFlights.map(entry => (
                    <tr key={entry.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-3 font-mono text-foreground">{formatDateBR(entry.date)}</td>
                      <td className="py-2 pr-3 font-medium text-foreground">{entry.flight_number}</td>
                      <td className="py-2 pr-3 text-foreground">{entry.departure_airport || entry.departure}</td>
                      <td className="py-2 pr-3 text-foreground">{entry.arrival_airport || entry.arrival}</td>
                      <td className="py-2 pr-3 font-mono text-muted-foreground">{formatTimeBR(entry.departure_time)}</td>
                      <td className="py-2 pr-3 font-mono text-muted-foreground">{formatTimeBR(entry.arrival_time)}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{entry.aircraft_type || '—'}</td>
                      <td className="py-2 text-foreground">{entry.duty_hours ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}

      <ImportHistoryCard onRosterChanged={reload} />
    </AppLayout>
  );
}
