import { useMemo } from 'react';
import { Shield, Clock, BedDouble, Plane, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { analyzeOperationalSchedule, formatComplianceStatus } from '@/lib/operational-analysis';
import { formatHoursMinutes } from '@/lib/date-utils';

interface RegulationStatusPanelProps {
  schedule: ScheduleEntry[];
}

interface Indicator {
  label: string;
  value: string;
  ratio: number;
  status: 'ok' | 'warning' | 'critical';
  icon: React.ElementType;
}

const statusMeta = {
  ok: { color: 'bg-success', text: 'text-success', label: 'NORMAL', badge: 'bg-success/15 border-success/30 text-success' },
  warning: { color: 'bg-warning', text: 'text-warning', label: 'ATENÇÃO', badge: 'bg-warning/15 border-warning/30 text-warning' },
  critical: { color: 'bg-destructive', text: 'text-destructive', label: 'CRÍTICO', badge: 'bg-destructive/15 border-destructive/30 text-destructive' },
};

export function RegulationStatusPanel({ schedule }: RegulationStatusPanelProps) {
  const analysis = useMemo(() => analyzeOperationalSchedule(schedule, 'America/Sao_Paulo'), [schedule]);

  const indicators = useMemo<Indicator[]>(() => {
    if (!analysis?.latest) {
      return [
        { label: 'Jornada', value: '—', ratio: 0, status: 'ok', icon: Clock },
        { label: 'Tempo de voo', value: '—', ratio: 0, status: 'ok', icon: Plane },
        { label: 'Descanso', value: '—', ratio: 0, status: 'ok', icon: BedDouble },
      ];
    }

    const latest = analysis.latest;
    const dutyRule = latest.rules.find((rule) => rule.ruleId === 'RBAC117_MAX_DUTY');
    const flightRule = latest.rules.find((rule) => rule.ruleId === 'RBAC117_MAX_FLIGHT');
    const restRule = latest.rules.find((rule) => rule.ruleId === 'RBAC117_MIN_REST');

    const mapRuleStatus = (severity?: string): Indicator['status'] => {
      if (severity === 'critical') return 'critical';
      if (severity === 'warning') return 'warning';
      return 'ok';
    };

    return [
      {
        label: 'Jornada',
        value: formatHoursMinutes(latest.duty.totalDutyHours),
        ratio: dutyRule?.limitUsed ? Math.min(((dutyRule.calculatedValue ?? 0) / dutyRule.limitUsed) * 100, 100) : 0,
        status: mapRuleStatus(dutyRule?.severity),
        icon: Clock,
      },
      {
        label: 'Tempo de voo',
        value: formatHoursMinutes(latest.duty.totalFlightHours),
        ratio: flightRule?.limitUsed ? Math.min(((flightRule.calculatedValue ?? 0) / flightRule.limitUsed) * 100, 100) : 0,
        status: mapRuleStatus(flightRule?.severity),
        icon: Plane,
      },
      {
        label: 'Descanso',
        value: latest.rest.restBeforeDutyHours == null ? '—' : formatHoursMinutes(latest.rest.restBeforeDutyHours),
        ratio: restRule?.limitUsed && restRule.calculatedValue != null ? Math.min((restRule.calculatedValue / restRule.limitUsed) * 100, 100) : 0,
        status: mapRuleStatus(restRule?.severity),
        icon: BedDouble,
      },
    ];
  }, [analysis]);

  const focusStatus = !analysis?.latest || analysis.latest.status === 'COMPLIANT'
    ? 'ok'
    : analysis.latest.status === 'WARNING'
      ? 'warning'
      : 'critical';
  const meta = statusMeta[focusStatus];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass rounded-2xl overflow-hidden">
      <div className="px-5 py-3 flex items-center justify-between border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className={`w-4 h-4 ${meta.text}`} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Calculadora operacional</p>
            <p className="text-[10px] text-muted-foreground">{analysis ? 'RBAC 117 • Lei 13.475 • ACT LATAM' : 'Aguardando escala'}</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${meta.badge}`}>
          {analysis?.latest ? formatComplianceStatus(analysis.latest.status) : 'Sem dados'}
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        {indicators.map((indicator, index) => {
          const sm = statusMeta[indicator.status];
          return (
            <div key={indicator.label}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <indicator.icon className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{indicator.label}</span>
                </div>
                <span className="text-xs font-bold text-foreground">{indicator.value}</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${sm.color}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${indicator.ratio}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 + index * 0.08 }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <Link to="/regulation" className="flex items-center justify-between px-5 py-2.5 border-t border-border/40 hover:bg-secondary/30 transition-colors">
        <span className="text-[10px] font-medium text-muted-foreground">Abrir calculadora operacional</span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
      </Link>
    </motion.div>
  );
}
