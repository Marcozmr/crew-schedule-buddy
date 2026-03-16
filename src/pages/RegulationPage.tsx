import { useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useScheduleData } from '@/hooks/useScheduleData';
import { checkCompliance } from '@/lib/rbac117';
import { ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, Moon, Calendar, Clock, Coffee } from 'lucide-react';
import { motion } from 'framer-motion';

export default function RegulationPage() {
  const { schedule, loading } = useScheduleData();
  const compliance = useMemo(() => checkCompliance(schedule), [schedule]);

  const icon = compliance.status === 'regular' ? ShieldCheck : compliance.status === 'atencao' ? ShieldAlert : ShieldX;
  const color = compliance.status === 'regular' ? 'text-success' : compliance.status === 'atencao' ? 'text-yellow-500' : 'text-destructive';
  const bg = compliance.status === 'regular' ? 'bg-success/10 border-success/30' : compliance.status === 'atencao' ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-destructive/10 border-destructive/30';
  const Icon = icon;

  return (
    <AppLayout>
      <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold text-foreground mb-6">
        Regulamentação RBAC 117
      </motion.h1>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : schedule.length === 0 ? (
        <div className="bg-card rounded-xl p-10 text-center shadow-card">
          <p className="text-muted-foreground">Nenhuma escala importada. Importe um PDF para ver a análise regulatória.</p>
        </div>
      ) : (
        <>
          {/* Status */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl p-6 shadow-card mb-6 border ${bg}`}>
            <div className="flex items-center gap-3 mb-4">
              <Icon className={`w-8 h-8 ${color}`} />
              <div>
                <h2 className="font-bold text-foreground text-xl">{compliance.label}</h2>
                <p className="text-xs text-muted-foreground">Baseado na escala ativa • Timezone: America/Sao_Paulo</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-background/60 rounded-lg p-4">
                <div className="flex items-center gap-1.5 mb-1"><Clock className="w-3.5 h-3.5 text-muted-foreground" /><p className="text-[10px] text-muted-foreground uppercase">Horas/Mês</p></div>
                <p className="text-xl font-bold text-foreground">{compliance.accumulatedHoursMonth.toFixed(1)}h</p>
                <p className="text-[10px] text-muted-foreground">máx 85h</p>
              </div>
              <div className="bg-background/60 rounded-lg p-4">
                <div className="flex items-center gap-1.5 mb-1"><Calendar className="w-3.5 h-3.5 text-muted-foreground" /><p className="text-[10px] text-muted-foreground uppercase">Horas/7d</p></div>
                <p className="text-xl font-bold text-foreground">{compliance.accumulatedHours7Days.toFixed(1)}h</p>
                <p className="text-[10px] text-muted-foreground">máx 44h</p>
              </div>
              <div className="bg-background/60 rounded-lg p-4">
                <div className="flex items-center gap-1.5 mb-1"><Moon className="w-3.5 h-3.5 text-muted-foreground" /><p className="text-[10px] text-muted-foreground uppercase">Madrugadas</p></div>
                <p className="text-xl font-bold text-foreground">{compliance.nightOpsCount}</p>
                <p className="text-[10px] text-muted-foreground">máx 2 consec.</p>
              </div>
              <div className="bg-background/60 rounded-lg p-4">
                <div className="flex items-center gap-1.5 mb-1"><Coffee className="w-3.5 h-3.5 text-muted-foreground" /><p className="text-[10px] text-muted-foreground uppercase">Folgas</p></div>
                <p className="text-xl font-bold text-foreground">{compliance.daysOffCount}</p>
                <p className="text-[10px] text-muted-foreground">mín 8/mês</p>
              </div>
            </div>
          </motion.div>

          {/* Alerts */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl p-6 shadow-card mb-6">
            <h2 className="font-semibold text-foreground mb-4">Alertas ({compliance.alerts.length})</h2>
            {compliance.alerts.length === 0 ? (
              <p className="text-sm text-success flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Dentro dos limites da RBAC 117</p>
            ) : (
              <div className="space-y-2">
                {compliance.alerts.map((alert, i) => (
                  <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${alert.type === 'danger' ? 'bg-destructive/10 text-destructive' : alert.type === 'warning' ? 'bg-yellow-500/10 text-yellow-600' : 'bg-primary/10 text-primary'}`}>
                    {alert.type === 'danger' ? <ShieldX className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
                    <div>
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-xs opacity-80">{alert.description}</p>
                      <p className="text-[10px] opacity-60 mt-0.5">{alert.reference}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Duty Periods */}
          {compliance.dutyPeriods.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-xl p-6 shadow-card">
              <h2 className="font-semibold text-foreground mb-4">Jornadas do Mês ({compliance.dutyPeriods.length})</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground text-xs">
                      <th className="py-2 pr-3">Data</th>
                      <th className="py-2 pr-3">Início</th>
                      <th className="py-2 pr-3">Fim</th>
                      <th className="py-2 pr-3">Voos</th>
                      <th className="py-2 pr-3">FH</th>
                      <th className="py-2">Duty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compliance.dutyPeriods.map((dp, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="py-2 pr-3 font-mono text-foreground">{dp.date}</td>
                        <td className="py-2 pr-3 font-mono text-foreground">{dp.startTime}</td>
                        <td className="py-2 pr-3 font-mono text-foreground">{dp.endTime}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{dp.flights.join(', ')}</td>
                        <td className="py-2 pr-3 text-foreground">{dp.totalFlightHours}h</td>
                        <td className="py-2 text-foreground">{dp.totalDutyHours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </>
      )}
    </AppLayout>
  );
}
