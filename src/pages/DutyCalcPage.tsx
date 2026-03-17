import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumericInput } from '@/components/ui/numeric-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Shield, Plane, AlertTriangle, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * RBAC 117 - Tabela de limites de jornada (horas)
 * Baseado no horário de apresentação e número de etapas.
 * 
 * Tripulação Simples (2 pilotos):
 * - Tabela A: hora de apresentação determina faixa
 * - Cada faixa tem limite por número de etapas
 *
 * Tripulação Composta (3 pilotos):
 * - Limites estendidos em +2h sobre simples
 *
 * Tripulação de Revezamento (4 pilotos):
 * - Limites estendidos em +6h sobre simples
 */

// RBAC 117 Appendix C - Duty limits by presentation hour and legs
// Format: [maxLegs1-2, maxLegs3-4, maxLegs5, maxLegs6, maxLegs7+]
const RBAC_DUTY_TABLE: Record<string, number[]> = {
  // Presentation hour ranges → [1-2 legs, 3-4 legs, 5 legs, 6 legs, 7+ legs]
  '06-08': [13, 12.5, 12, 11.5, 11],    // Diurno início manhã
  '08-12': [13, 12.5, 12, 11.5, 11],    // Diurno manhã/meio-dia
  '12-18': [12, 11.5, 11, 10.5, 10],    // Diurno tarde
  '18-22': [12, 11.5, 11, 10.5, 10],    // Noturno início noite
  '22-02': [11, 10.5, 10, 9.5, 9],      // Madrugada (WOCL proximity)
  '02-06': [10, 9.5, 9, 8.5, 8],        // WOCL pleno
};

// Flight hour limits by period (RBAC 117)
const FLIGHT_LIMITS = {
  monthly: 85,        // 30 dias corridos
  quarterly: 230,     // 90 dias corridos
  yearly: 850,        // 365 dias corridos
  '28days': { narrowbody: 90, widebody: 100 }, // 28 dias
};

function getDutyLimitKey(hour: number): string {
  if (hour >= 6 && hour < 8) return '06-08';
  if (hour >= 8 && hour < 12) return '08-12';
  if (hour >= 12 && hour < 18) return '12-18';
  if (hour >= 18 && hour < 22) return '18-22';
  if (hour >= 22 || hour < 2) return '22-02';
  return '02-06'; // 2-6
}

function getLegsIndex(legs: number): number {
  if (legs <= 2) return 0;
  if (legs <= 4) return 1;
  if (legs === 5) return 2;
  if (legs === 6) return 3;
  return 4;
}

function getCrewExtension(crewType: string): number {
  if (crewType === 'composta') return 2;
  if (crewType === 'revezamento') return 6;
  return 0;
}

function getPeriodLabel(hour: number): string {
  if (hour >= 6 && hour < 18) return 'Diurno';
  if (hour >= 18 && hour < 22) return 'Noturno';
  if (hour >= 22 || hour < 2) return 'Noturno (pré-WOCL)';
  return 'Madrugada (WOCL)';
}

function isInWOCL(hour: number): boolean {
  return hour >= 2 && hour < 6;
}

export default function DutyCalcPage() {
  const [report, setReport] = useState('');
  const [stages, setStages] = useState<number | null>(1);
  const [crewType, setCrewType] = useState('simples');
  const [takeoff, setTakeoff] = useState('');
  const [landing, setLanding] = useState('');
  const [aircraftType, setAircraftType] = useState('narrowbody');
  const [result, setResult] = useState<any>(null);

  const calculate = () => {
    if (!report || !takeoff || !landing) return;
    const stageCount = stages ?? 1;
    const repDate = new Date(`2026-01-01T${report}`);
    const tkDate = new Date(`2026-01-01T${takeoff}`);
    let ldDate = new Date(`2026-01-01T${landing}`);
    if (ldDate <= tkDate) ldDate = new Date(ldDate.getTime() + 86400000);

    const flightMs = ldDate.getTime() - tkDate.getTime();
    const flightH = flightMs / 3600000;

    // Duty = report until 30min after landing
    const dutyMs = ldDate.getTime() - repDate.getTime() + 30 * 60000;
    const dutyH = dutyMs / 3600000;

    // RBAC limit calculation
    const reportHour = repDate.getHours() + repDate.getMinutes() / 60;
    const dutyLimitKey = getDutyLimitKey(repDate.getHours());
    const legsIdx = getLegsIndex(stageCount);
    const baseDutyLimit = RBAC_DUTY_TABLE[dutyLimitKey]?.[legsIdx] || 11;
    const crewExtension = getCrewExtension(crewType);
    const dutyLimit = baseDutyLimit + crewExtension;

    // Flight limit (28 days)
    const flightLimit28d = FLIGHT_LIMITS['28days'][aircraftType as keyof typeof FLIGHT_LIMITS['28days']] || 90;

    const period = getPeriodLabel(repDate.getHours());
    const wocl = isInWOCL(repDate.getHours());
    const dutyOk = dutyH <= dutyLimit;
    const flightOk = flightH <= flightLimit28d; // simplified single-flight check

    setResult({
      flightHours: Math.round(flightH * 10) / 10,
      dutyHours: Math.round(dutyH * 10) / 10,
      dutyLimit: Math.round(dutyLimit * 10) / 10,
      flightLimit28d,
      flightLimitMonthly: FLIGHT_LIMITS.monthly,
      dutyOk,
      flightOk,
      period,
      wocl,
      reportHour: report,
      dutyLimitKey,
      crewExtension,
      baseDutyLimit: Math.round(baseDutyLimit * 10) / 10,
    });
  };

  return (
    <AppLayout>
      <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
        <Clock className="w-6 h-6 text-primary" />Cálculo de Jornada RBAC 117
      </motion.h1>

      <div className="bg-card rounded-xl p-6 shadow-card mb-6 border border-border max-w-lg">
        <p className="text-xs text-muted-foreground mb-4">Horários em America/Sao_Paulo (BRT) • Limites baseados na tabela RBAC 117</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div><Label className="text-xs">Apresentação</Label><Input type="time" value={report} onChange={e => setReport(e.target.value)} /></div>
          <div><Label className="text-xs">Etapas</Label><NumericInput value={stages} onValueChange={setStages} min={1} max={20} decimals={0} blurDefault={1} /></div>
          <div><Label className="text-xs">Decolagem</Label><Input type="time" value={takeoff} onChange={e => setTakeoff(e.target.value)} /></div>
          <div><Label className="text-xs">Pouso (último trecho)</Label><Input type="time" value={landing} onChange={e => setLanding(e.target.value)} /></div>
          <div>
            <Label className="text-xs">Tipo Tripulação</Label>
            <Select value={crewType} onValueChange={setCrewType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simples">Simples (2 pilotos)</SelectItem>
                <SelectItem value="composta">Composta (3 pilotos)</SelectItem>
                <SelectItem value="revezamento">Revezamento (4 pilotos)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo Aeronave</Label>
            <Select value={aircraftType} onValueChange={setAircraftType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="narrowbody">Narrowbody (≤90h/28d)</SelectItem>
                <SelectItem value="widebody">Widebody (≤100h/28d)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={calculate} className="w-full gradient-sky text-primary-foreground">Calcular</Button>

        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-4">
            {/* Overall status */}
            <div className={`rounded-xl p-4 border ${result.dutyOk ? 'bg-success/10 border-success/30' : 'bg-destructive/10 border-destructive/30'}`}>
              <div className="flex items-center gap-2 mb-3">
                {result.dutyOk ? <CheckCircle className="w-5 h-5 text-success" /> : <AlertTriangle className="w-5 h-5 text-destructive" />}
                <span className={`font-bold ${result.dutyOk ? 'text-success' : 'text-destructive'}`}>
                  {result.dutyOk ? 'DENTRO DO LIMITE RBAC' : 'EXCEDE O LIMITE RBAC'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Período: <span className="font-medium text-foreground">{result.period}</span>
                {result.wocl && <span className="ml-2 text-destructive font-bold">⚠ WOCL 02:00–06:00</span>}
              </p>
            </div>

            {/* Detailed results */}
            <div className="grid grid-cols-2 gap-3">
              {/* Duty section */}
              <div className="bg-card rounded-xl p-4 border border-border col-span-2">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Jornada</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Jornada Total</p>
                    <p className={`text-2xl font-bold font-mono ${result.dutyOk ? 'text-foreground' : 'text-destructive'}`}>{result.dutyHours}h</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Limite RBAC Jornada</p>
                    <p className="text-2xl font-bold font-mono text-foreground">{result.dutyLimit}h</p>
                    <p className="text-[9px] text-muted-foreground">Base {result.baseDutyLimit}h {result.crewExtension > 0 ? `+ ${result.crewExtension}h (${crewType})` : ''}</p>
                  </div>
                </div>
                {/* Duty bar */}
                <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${result.dutyHours / result.dutyLimit > 0.9 ? 'bg-destructive' : result.dutyHours / result.dutyLimit > 0.75 ? 'bg-warning' : 'bg-success'}`}
                    style={{ width: `${Math.min((result.dutyHours / result.dutyLimit) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Flight section */}
              <div className="bg-card rounded-xl p-4 border border-border col-span-2">
                <div className="flex items-center gap-2 mb-3">
                  <Plane className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Horas de Voo</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Horas Voo</p>
                    <p className="text-xl font-bold font-mono text-foreground">{result.flightHours}h</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Limite 28d ({aircraftType === 'widebody' ? 'WB' : 'NB'})</p>
                    <p className="text-xl font-bold font-mono text-foreground">{result.flightLimit28d}h</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Limite Mensal</p>
                    <p className="text-xl font-bold font-mono text-foreground">{result.flightLimitMonthly}h</p>
                  </div>
                </div>
              </div>
            </div>

            {/* RBAC reference */}
            <div className="rounded-xl bg-muted/50 p-3 text-[10px] text-muted-foreground space-y-1">
              <p className="font-bold text-foreground text-xs mb-1">Referência RBAC 117</p>
              <p>• Apresentação: <span className="font-mono text-foreground">{result.reportHour}</span> → Faixa: <span className="font-mono text-foreground">{result.dutyLimitKey}</span></p>
              <p>• Etapas: <span className="font-mono text-foreground">{stages}</span> → Índice: <span className="font-mono text-foreground">{getLegsIndex(stages ?? 1) + 1}</span></p>
              <p>• Tripulação: <span className="font-mono text-foreground capitalize">{crewType}</span> {result.crewExtension > 0 && `(+${result.crewExtension}h extensão)`}</p>
              <p>• WOCL (02:00–06:00): <span className={`font-bold ${result.wocl ? 'text-destructive' : 'text-success'}`}>{result.wocl ? 'SIM' : 'NÃO'}</span></p>
            </div>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
