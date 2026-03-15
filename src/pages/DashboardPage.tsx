import { useMemo, useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { StatCard } from '@/components/StatCard';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { checkCompliance, ComplianceResult } from '@/lib/rbac117';
import { searchByFlightNumber } from '@/lib/aviation-api';
import { Clock, CalendarDays, Plane, Coffee, AlertCircle, TrendingUp, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, Moon, Timer } from 'lucide-react';
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
  const { profile, user } = useAuth();
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);

  const loadSchedule = async () => {
    const { data } = await supabase.from('schedule_entries').select('*').order('date', { ascending: true });
    if (data) setSchedule(data as ScheduleEntry[]);
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  useEffect(() => {
    const handleFocus = () => loadSchedule();
    window.addEventListener('focus', handleFocus);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadSchedule();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Check for flight delays and create notifications
  useEffect(() => {
    if (!user || schedule.length === 0) return;

    const checkDelays = async () => {
      const now = new Date();
      const todayEntries = schedule.filter(e => {
        const parts = e.date.split(/[\/\-]/);
        const entryDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        return entryDate.toDateString() === now.toDateString();
      });

      for (const entry of todayEntries) {
        try {
          const flightsData = await searchByFlightNumber(entry.flight_number);
          const flight = flightsData[0];

          if (flight?.departure?.delay && flight.departure.delay > 15) {
            // Check if notification already exists
            const { data: existing } = await supabase
              .from('notifications')
              .select('id')
              .eq('user_id', user.id)
              .eq('title', `Atraso: ${entry.flight_number}`)
              .gte('created_at', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString())
              .maybeSingle();

            if (!existing) {
              await supabase.from('notifications').insert({
                user_id: user.id,
                title: `Atraso: ${entry.flight_number}`,
                message: `Voo ${entry.flight_number} (${entry.departure}→${entry.arrival}) com atraso de ${flight.departure.delay} minutos na partida.`,
                type: 'warning',
              });
            }
          }

          if (flight?.flight_status === 'cancelled') {
            const { data: existing } = await supabase
              .from('notifications')
              .select('id')
              .eq('user_id', user.id)
              .eq('title', `Cancelado: ${entry.flight_number}`)
              .gte('created_at', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString())
              .maybeSingle();

            if (!existing) {
              await supabase.from('notifications').insert({
                user_id: user.id,
                title: `Cancelado: ${entry.flight_number}`,
                message: `Voo ${entry.flight_number} (${entry.departure}→${entry.arrival}) foi CANCELADO.`,
                type: 'danger',
              });
            }
          }
        } catch {
          // silently fail - API might be unavailable
        }
      }
    };

    checkDelays();
    const interval = setInterval(checkDelays, 15 * 60 * 1000); // Check every 15 min
    return () => clearInterval(interval);
  }, [user, schedule]);

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

  // RBAC 117 Compliance check
  const compliance = useMemo<ComplianceResult>(() => {
    return checkCompliance(schedule);
  }, [schedule]);

  const hoursPercentage = Math.min((stats.totalHours / stats.maxHours) * 100, 100);

  const complianceIcon = compliance.status === 'regular' ? ShieldCheck :
    compliance.status === 'atencao' ? ShieldAlert : ShieldX;

  const complianceColor = compliance.status === 'regular' ? 'text-success' :
    compliance.status === 'atencao' ? 'text-yellow-500' : 'text-destructive';

  const complianceBg = compliance.status === 'regular' ? 'bg-success/10 border-success/30' :
    compliance.status === 'atencao' ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-destructive/10 border-destructive/30';

  return (
    <AppLayout>
      <div className="mb-8">
        <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl md:text-3xl font-bold text-foreground">
          Olá, {profile?.name || 'Tripulante'} ✈️
        </motion.h1>
        <p className="text-muted-foreground mt-1">{profile?.airline ? `${profile.airline} • ` : ''}Resumo do mês atual</p>
      </div>

      {/* RBAC 117 Compliance Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-xl p-6 shadow-card mb-8 border ${complianceBg}`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {(() => {
              const Icon = complianceIcon;
              return <Icon className={`w-7 h-7 ${complianceColor}`} />;
            })()}
            <div>
              <h2 className="font-bold text-foreground text-lg">RBAC 117 — {compliance.label}</h2>
              <p className="text-xs text-muted-foreground">Regulamentação de Fadiga • Apêndice B</p>
            </div>
          </div>
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${complianceBg} ${complianceColor}`}>
            {compliance.label}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-background/50 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Horas/Mês</p>
            <p className="text-lg font-bold text-foreground">{compliance.accumulatedHoursMonth.toFixed(1)}h</p>
            <p className="text-[10px] text-muted-foreground">máx 85h</p>
          </div>
          <div className="bg-background/50 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Horas/7 dias</p>
            <p className="text-lg font-bold text-foreground">{compliance.accumulatedHours7Days.toFixed(1)}h</p>
            <p className="text-[10px] text-muted-foreground">máx 44h</p>
          </div>
          <div className="bg-background/50 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Moon className="w-3 h-3" />Madrugadas</p>
            <p className="text-lg font-bold text-foreground">{compliance.nightOpsCount}</p>
            <p className="text-[10px] text-muted-foreground">máx 4/168h</p>
          </div>
          <div className="bg-background/50 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Folgas</p>
            <p className="text-lg font-bold text-foreground">{compliance.daysOffCount}</p>
            <p className="text-[10px] text-muted-foreground">mín 8/mês</p>
          </div>
        </div>

        {compliance.alerts.length > 0 && (
          <div className="space-y-2">
            {compliance.alerts.map((alert, i) => (
              <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                alert.type === 'danger' ? 'bg-destructive/10 text-destructive' :
                alert.type === 'warning' ? 'bg-yellow-500/10 text-yellow-600' :
                'bg-primary/10 text-primary'
              }`}>
                {alert.type === 'danger' ? <ShieldX className="w-4 h-4 mt-0.5 shrink-0" /> :
                  alert.type === 'warning' ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> :
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                <div>
                  <p className="font-medium">{alert.title}</p>
                  <p className="text-xs opacity-80">{alert.description}</p>
                  <p className="text-[10px] opacity-50 mt-0.5">{alert.reference}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {compliance.alerts.length === 0 && schedule.length > 0 && (
          <p className="text-sm text-success flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Sua escala está dentro dos limites da RBAC 117
          </p>
        )}
      </motion.div>

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
          <motion.div initial={{ width: 0 }} animate={{ width: `${hoursPercentage}%` }} transition={{ duration: 1, ease: 'easeOut' }} className={`h-full rounded-full ${hoursPercentage > 90 ? 'bg-destructive' : hoursPercentage > 75 ? 'bg-yellow-500' : 'gradient-sky'}`} />
        </div>
        {hoursPercentage > 80 && (
          <div className="flex items-center gap-2 mt-3 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Atenção: próximo do limite de horas mensais (RBAC 117)</span>
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
