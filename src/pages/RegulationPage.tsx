import { useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useScheduleData } from '@/hooks/useScheduleData';
import { checkCompliance } from '@/lib/rbac117';
import { formatDateBR } from '@/lib/date-utils';
import { AlertTriangle, Info, Plane } from 'lucide-react';
import { motion } from 'framer-motion';

function formatDuration(decimalHours: number): string {
  if (!decimalHours || decimalHours <= 0) return '0h 00min';
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  return `${h}h ${m.toString().padStart(2, '0')}min`;
}

function formatRestDisplay(rest: string | null): string {
  if (!rest) return '—';
  // Convert "15h23m" format to "15h 23min"
  const match = rest.match(/^(\d+)h(\d+)m/);
  if (match) return `${match[1]}h ${match[2]}min`;
  return rest;
}

export default function RegulationPage() {
  const { schedule, loading } = useScheduleData();
  const compliance = useMemo(() => checkCompliance(schedule), [schedule]);

  // Convert RBAC alerts to informational-only alerts with neutral tone
  const infoAlerts = useMemo(() => {
    return compliance.alerts.map(alert => {
      let title = alert.title
        .replace(/excedido/gi, 'acima do referencial')
        .replace(/insuficiente/gi, 'reduzido')
        .replace(/insuficientes/gi, 'reduzidas')
        .replace(/excedidas/gi, 'acima do referencial')
        .replace(/Sobreposição de jornadas/gi, 'Possível sobreposição de jornadas');
      
      if (title.includes('Repouso') && !title.includes('Possível')) {
        title = title.replace('Repouso', 'Possível repouso');
      }
      if (title.includes('Jornada') && title.includes('14h') && !title.includes('Possível')) {
        title = 'Possível jornada longa' + title.substring(title.indexOf('('));
      }
      if (title.includes('Madrugadas') || title.includes('madrugadas')) {
        title = 'Atenção para madrugadas consecutivas';
      }

      return {
        title,
        description: alert.description,
        reference: alert.reference,
      };
    });
  }, [compliance.alerts]);

  return (
    <AppLayout>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : schedule.length === 0 ? (
        <div className="bg-card rounded-xl p-10 text-center shadow-card">
          <p className="text-muted-foreground">Nenhuma escala importada. Importe um PDF para ver a análise operacional.</p>
        </div>
      ) : (
        <>
          {/* Page Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Análise Operacional</h1>
            <p className="text-sm text-muted-foreground mt-1">Jornadas, repousos e avisos operacionais da escala ativa</p>
          </motion.div>

          {/* Informational Alerts */}
          {infoAlerts.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-card mb-6">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-primary" />
                Avisos operacionais ({infoAlerts.length})
              </h2>
              <div className="space-y-2">
                {infoAlerts.map((alert, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm bg-muted/60 text-muted-foreground">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-yellow-500" />
                    <div>
                      <p className="font-medium text-foreground">{alert.title}</p>
                      <p className="text-xs opacity-80">{alert.description}</p>
                      <p className="text-[10px] opacity-50 mt-0.5">{alert.reference}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {infoAlerts.length === 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-card mb-6">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                Nenhum aviso operacional identificado na escala ativa.
              </p>
            </motion.div>
          )}

          {/* Duty Table */}
          {compliance.dutyPeriods.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card rounded-xl p-6 shadow-card mb-6">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Plane className="w-5 h-5 text-primary" />
                Tabela de Jornadas ({compliance.dutyPeriods.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground text-xs">
                      <th className="py-2 pr-3">Data</th>
                      <th className="py-2 pr-3">Início</th>
                      <th className="py-2 pr-3">Fim</th>
                      <th className="py-2 pr-3">Voos</th>
                      <th className="py-2 pr-3">Horas de Voo</th>
                      <th className="py-2 pr-3">Jornada</th>
                      <th className="py-2">Repouso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compliance.dutyPeriods.map((dp, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="py-2 pr-3 font-mono text-foreground">{formatDateBR(dp.date)}</td>
                        <td className="py-2 pr-3 font-mono text-foreground">{dp.startTime}</td>
                        <td className="py-2 pr-3 font-mono text-foreground">{dp.endTime}</td>
                        <td className="py-2 pr-3 text-muted-foreground text-xs">{dp.flights.join(', ') || '—'}</td>
                        <td className="py-2 pr-3 text-foreground">{formatDuration(dp.totalFlightHours)}</td>
                        <td className="py-2 pr-3 text-foreground">{formatDuration(dp.totalDutyHours)}</td>
                        <td className={`py-2 font-mono ${dp.restWarning ? 'text-yellow-500 font-semibold' : 'text-foreground'}`}>
                          {formatRestDisplay(dp.restUntilNext)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Legal Disclaimer */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="text-center py-6">
            <p className="text-xs text-muted-foreground/70 max-w-2xl mx-auto leading-relaxed">
              Os alertas apresentados são apenas informativos e não substituem a regulamentação oficial da empresa aérea ou autoridade aeronáutica.
            </p>
          </motion.div>
        </>
      )}
    </AppLayout>
  );
}
