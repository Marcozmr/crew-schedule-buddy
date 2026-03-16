import { useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { StatCard } from '@/components/StatCard';
import { PdfImportDialog } from '@/components/PdfImportDialog';
import { ImportHistoryCard } from '@/components/ImportHistoryCard';
import { useAuth } from '@/lib/auth-context';
import { useScheduleData } from '@/hooks/useScheduleData';
import { checkCompliance, ComplianceResult } from '@/lib/rbac117';
import { Clock, CalendarDays, Plane, Coffee, AlertCircle, TrendingUp, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, Moon, Upload, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const { profile } = useAuth();
  const { schedule, loading, reload } = useScheduleData();

  // Separate flights from non-flights
  const flights = useMemo(() => schedule.filter(e => e.is_flight), [schedule]);

  const parseEntryDate = (dateStr: string) => {
    if (dateStr.includes('-') && dateStr.indexOf('-') === 4) return new Date(dateStr + 'T00:00:00');
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length < 3) return new Date();
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  };

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const monthEntries = flights.filter(e => {
      const d = parseEntryDate(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalFlightHours = monthEntries.reduce((sum, e) => sum + (e.flight_hours || 0), 0);
    const flightDays = new Set(monthEntries.map(e => e.date)).size;
    const daysOff = daysInMonth - flightDays;

    const sorted = [...monthEntries].sort((a, b) => parseEntryDate(a.date).getTime() - parseEntryDate(b.date).getTime());

    const nextFlight = sorted.find(e => parseEntryDate(e.date) >= now);

    return { totalFlights: monthEntries.length, totalHours: Math.round(totalFlightHours * 10) / 10, daysOff, flightDays, nextFlight, maxHours: 85 };
  }, [flights]);

  const compliance = useMemo<ComplianceResult>(() => checkCompliance(schedule), [schedule]);
  const hoursPercentage = Math.min((stats.totalHours / stats.maxHours) * 100, 100);
  const complianceIcon = compliance.status === 'regular' ? ShieldCheck : compliance.status === 'atencao' ? ShieldAlert : ShieldX;
  const complianceColor = compliance.status === 'regular' ? 'text-success' : compliance.status === 'atencao' ? 'text-yellow-500' : 'text-destructive';
  const complianceBg = compliance.status === 'regular' ? 'bg-success/10 border-success/30' : compliance.status === 'atencao' ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-destructive/10 border-destructive/30';

  const displayFlights = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthFlights = flights.filter(e => {
      const d = parseEntryDate(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
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

          {/* RBAC 117 */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl p-6 shadow-card mb-6 border ${complianceBg}`}>
            <div className="flex items-center gap-3 mb-4">
              {(() => { const Icon = complianceIcon; return <Icon className={`w-7 h-7 ${complianceColor}`} />; })()}
              <div><h2 className="font-bold text-foreground text-lg">RBAC 117 — {compliance.label}</h2><p className="text-xs text-muted-foreground">Regulamentação de Fadiga</p></div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-background/50 rounded-lg p-3"><p className="text-[10px] text-muted-foreground uppercase">Horas/Mês</p><p className="text-lg font-bold text-foreground">{compliance.accumulatedHoursMonth.toFixed(1)}h</p></div>
              <div className="bg-background/50 rounded-lg p-3"><p className="text-[10px] text-muted-foreground uppercase">Horas/7d</p><p className="text-lg font-bold text-foreground">{compliance.accumulatedHours7Days.toFixed(1)}h</p></div>
              <div className="bg-background/50 rounded-lg p-3"><p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1"><Moon className="w-3 h-3" />Madrugadas</p><p className="text-lg font-bold text-foreground">{compliance.nightOpsCount}</p></div>
              <div className="bg-background/50 rounded-lg p-3"><p className="text-[10px] text-muted-foreground uppercase">Folgas</p><p className="text-lg font-bold text-foreground">{compliance.daysOffCount}</p></div>
            </div>
            {compliance.alerts.length > 0 && (
              <div className="space-y-2">
                {compliance.alerts.map((alert, i) => (
                  <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${alert.type === 'danger' ? 'bg-destructive/10 text-destructive' : alert.type === 'warning' ? 'bg-yellow-500/10 text-yellow-600' : 'bg-primary/10 text-primary'}`}>
                    {alert.type === 'danger' ? <ShieldX className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
                    <div><p className="font-medium">{alert.title}</p><p className="text-xs opacity-80">{alert.description}</p></div>
                  </div>
                ))}
              </div>
            )}
            {compliance.alerts.length === 0 && <p className="text-sm text-success flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Dentro dos limites da RBAC 117</p>}
          </motion.div>

          {/* Hours bar */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl p-6 shadow-card mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" /><h2 className="font-semibold text-foreground">Horas do Mês</h2></div>
              <span className="text-sm font-mono text-muted-foreground">{stats.totalHours}h / {stats.maxHours}h</span>
            </div>
            <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${hoursPercentage}%` }} transition={{ duration: 1 }} className={`h-full rounded-full ${hoursPercentage > 90 ? 'bg-destructive' : hoursPercentage > 75 ? 'bg-yellow-500' : 'gradient-sky'}`} />
            </div>
          </motion.div>

          {/* Next flight */}
          {stats.nextFlight && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-xl p-6 shadow-card mb-6">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Plane className="w-5 h-5 text-primary" />Próximo Voo</h2>
              <div className="flex flex-wrap items-center gap-6">
                <div><p className="text-xs text-muted-foreground">Data</p><p className="font-bold text-foreground">{stats.nextFlight.date}</p></div>
                <div><p className="text-xs text-muted-foreground">Voo</p><p className="font-bold text-foreground">{stats.nextFlight.flight_number}</p></div>
                <div><p className="text-xs text-muted-foreground">Rota</p><p className="font-bold text-foreground">{stats.nextFlight.departure_airport || stats.nextFlight.departure} → {stats.nextFlight.arrival_airport || stats.nextFlight.arrival}</p></div>
                <div><p className="text-xs text-muted-foreground">Apresentação</p><p className="font-bold text-primary">{stats.nextFlight.report_time || stats.nextFlight.departure_time}</p></div>
                {stats.nextFlight.duty_hours != null && <div><p className="text-xs text-muted-foreground">Duty</p><p className="font-bold text-foreground">{stats.nextFlight.duty_hours}h</p></div>}
              </div>
            </motion.div>
          )}

          {/* Flight table */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card rounded-xl p-6 shadow-card mb-6">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Plane className="w-5 h-5 text-primary" />Voos ({displayFlights.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground text-xs">
                    <th className="py-2 pr-3">Data</th>
                    <th className="py-2 pr-3">Voo</th>
                    <th className="py-2 pr-3">Origem</th>
                    <th className="py-2 pr-3">Destino</th>
                    <th className="py-2 pr-3">Saída</th>
                    <th className="py-2 pr-3">Chegada</th>
                    <th className="py-2 pr-3">Aeronave</th>
                    <th className="py-2">Duty</th>
                  </tr>
                </thead>
                <tbody>
                  {displayFlights.map(entry => (
                    <tr key={entry.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-3 font-mono text-foreground">{entry.date}</td>
                      <td className="py-2 pr-3 font-medium text-foreground">{entry.flight_number}</td>
                      <td className="py-2 pr-3 text-foreground">{entry.departure_airport || entry.departure}</td>
                      <td className="py-2 pr-3 text-foreground">{entry.arrival_airport || entry.arrival}</td>
                      <td className="py-2 pr-3 font-mono text-muted-foreground">{entry.departure_time !== '00:00' ? entry.departure_time : '—'}</td>
                      <td className="py-2 pr-3 font-mono text-muted-foreground">{entry.arrival_time !== '00:00' ? entry.arrival_time : '—'}</td>
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
