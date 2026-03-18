import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Info, Plane, Shield } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { useScheduleData } from '@/hooks/useScheduleData';
import { useOperationalPreferences } from '@/hooks/useOperationalPreferences';
import { formatDateBR, formatHoursMinutes } from '@/lib/date-utils';
import { analyzeOperationalSchedule, formatComplianceStatus } from '@/lib/operational-analysis';
import { OperationalCalculatorPanel } from '@/components/regulation/OperationalCalculatorPanel';

export default function RegulationPage() {
  const { schedule, loading } = useScheduleData();
  const { timezone, homeBase } = useOperationalPreferences();

  const analysis = useMemo(
    () => analyzeOperationalSchedule(schedule, timezone, homeBase),
    [schedule, timezone, homeBase],
  );

  const focus = analysis?.focus ?? null;
  const focusAlerts = analysis?.focusAlerts ?? [];

  return (
    <AppLayout>
      <div className="space-y-6 pb-10">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground">Calculadora operacional</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Motor único de análise operacional aplicado no dashboard, jornada, descanso, alertas e limites.
          </p>
        </motion.div>

        <OperationalCalculatorPanel timezone={timezone} homeBase={homeBase} />

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !analysis || analysis.results.length === 0 ? (
          <div className="glass p-6">
            <p className="text-sm text-muted-foreground">
              Nenhuma escala importada. Importe um PDF para ver a análise consolidada da sua operação.
            </p>
          </div>
        ) : (
          <>
            <div className="glass p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-xl bg-secondary/50 p-4">
                  <p className="text-xs text-muted-foreground">Situação atual</p>
                  <p className="text-base font-semibold text-foreground mt-1">{focus ? formatComplianceStatus(focus.status) : 'Sem jornada relevante'}</p>
                </div>
                <div className="rounded-xl bg-secondary/50 p-4">
                  <p className="text-xs text-muted-foreground">Jornadas avaliadas</p>
                  <p className="text-base font-semibold text-foreground mt-1">{analysis.results.length}</p>
                </div>
                <div className="rounded-xl bg-secondary/50 p-4">
                  <p className="text-xs text-muted-foreground">Alertas relevantes</p>
                  <p className="text-base font-semibold text-foreground mt-1">{focusAlerts.length}</p>
                </div>
                <div className="rounded-xl bg-secondary/50 p-4">
                  <p className="text-xs text-muted-foreground">Motor</p>
                  <p className="text-base font-semibold text-foreground mt-1">Análise operacional</p>
                </div>
              </div>
            </div>

            <div className="glass p-6">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Alertas relevantes
              </h2>
              {focusAlerts.length > 0 ? (
                <div className="space-y-2">
                  {focusAlerts.map((alert, index) => (
                    <div key={`${alert.ruleId}-${index}`} className="flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2 text-sm">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-warning" />
                      <div>
                        <p className="font-medium text-foreground">{alert.message}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDateBR(alert.dutyDate.slice(0, 10))}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-success flex items-center gap-2">
                  <Info className="w-4 h-4" /> Nenhum alerta relevante no cenário atual.
                </p>
              )}
            </div>

            <div className="glass p-6">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Plane className="w-5 h-5 text-primary" />
                Jornadas auditadas
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3">Data</th>
                      <th className="py-2 pr-3">Apresentação</th>
                      <th className="py-2 pr-3">Fim da jornada</th>
                      <th className="py-2 pr-3">Pós-voo</th>
                      <th className="py-2 pr-3">Trechos</th>
                      <th className="py-2 pr-3">Tempo de voo</th>
                      <th className="py-2 pr-3">Jornada</th>
                      <th className="py-2 pr-3">Descanso anterior</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.results.map((result, index) => (
                      <tr key={index} className="border-b border-border last:border-0">
                        <td className="py-2 pr-3 font-mono text-foreground">{formatDateBR(result.duty.reportTimeLocal.slice(0, 10))}</td>
                        <td className="py-2 pr-3 font-mono text-foreground">{result.duty.reportTimeLocal.slice(11, 16)}</td>
                        <td className="py-2 pr-3 font-mono text-foreground">{result.duty.endTimeLocal.slice(11, 16)}</td>
                        <td className="py-2 pr-3 text-foreground">{result.duty.postFlightMinutes} min</td>
                        <td className="py-2 pr-3 text-foreground">{result.duty.sectorCount}</td>
                        <td className="py-2 pr-3 text-foreground">{formatHoursMinutes(result.duty.totalFlightHours)}</td>
                        <td className="py-2 pr-3 text-foreground">{formatHoursMinutes(result.duty.totalDutyHours)}</td>
                        <td className="py-2 pr-3 text-foreground">{result.rest.restBeforeDutyHours == null ? '—' : formatHoursMinutes(result.rest.restBeforeDutyHours)}</td>
                        <td className="py-2 text-foreground">{formatComplianceStatus(result.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
