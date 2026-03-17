import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumericInput } from '@/components/ui/numeric-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock } from 'lucide-react';
import { motion } from 'framer-motion';

const DUTY_LIMITS: Record<string, Record<string, number>> = {
  simples: { '1-2': 12, '3-4': 12, '5': 11, '6': 10, '7+': 9 },
  composta: { '1-2': 14, '3-4': 14, '5': 13, '6': 12, '7+': 11 },
  revezamento: { '1-2': 18, '3-4': 18, '5': 17, '6': 16, '7+': 15 },
};

export default function DutyCalcPage() {
  const [report, setReport] = useState('');
  const [stages, setStages] = useState<number | null>(1);
  const [crewType, setCrewType] = useState('simples');
  const [period, setPeriod] = useState('diurno');
  const [takeoff, setTakeoff] = useState('');
  const [landing, setLanding] = useState('');
  const [result, setResult] = useState<any>(null);

  const getLegsKey = (n: number) => n <= 2 ? '1-2' : n <= 4 ? '3-4' : n === 5 ? '5' : n === 6 ? '6' : '7+';

  const calculate = () => {
    if (!report || !takeoff || !landing) return;
    const stageCount = stages ?? 1;
    const repDate = new Date(`2026-01-01T${report}`);
    const tkDate = new Date(`2026-01-01T${takeoff}`);
    let ldDate = new Date(`2026-01-01T${landing}`);
    if (ldDate <= tkDate) ldDate = new Date(ldDate.getTime() + 86400000);

    const flightMs = ldDate.getTime() - tkDate.getTime();
    const flightH = flightMs / 3600000;

    const dutyMs = ldDate.getTime() - repDate.getTime() + 30 * 60000;
    const dutyH = dutyMs / 3600000;

    const limit = DUTY_LIMITS[crewType]?.[getLegsKey(stageCount)] || 12;

    setResult({
      flightHours: Math.round(flightH * 10) / 10,
      dutyHours: Math.round(dutyH * 10) / 10,
      limit,
      ok: dutyH <= limit,
      period,
    });
  };

  return (
    <AppLayout>
      <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
        <Clock className="w-6 h-6 text-primary" />Cálculo de Jornada
      </motion.h1>

      <div className="bg-card rounded-xl p-6 shadow-card mb-6 border border-border max-w-lg">
        <p className="text-xs text-muted-foreground mb-4">Horários em America/Sao_Paulo (BRT)</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div><Label className="text-xs">Apresentação</Label><Input type="time" value={report} onChange={e => setReport(e.target.value)} /></div>
          <div><Label className="text-xs">Etapas</Label><NumericInput value={stages} onValueChange={setStages} min={1} max={20} decimals={0} blurDefault={1} /></div>
          <div><Label className="text-xs">Decolagem</Label><Input type="time" value={takeoff} onChange={e => setTakeoff(e.target.value)} /></div>
          <div><Label className="text-xs">Pouso</Label><Input type="time" value={landing} onChange={e => setLanding(e.target.value)} /></div>
          <div>
            <Label className="text-xs">Tipo Tripulação</Label>
            <Select value={crewType} onValueChange={setCrewType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simples">Simples</SelectItem>
                <SelectItem value="composta">Composta</SelectItem>
                <SelectItem value="revezamento">Revezamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Período</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="diurno">Diurno</SelectItem>
                <SelectItem value="noturno">Noturno</SelectItem>
                <SelectItem value="misto">Misto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={calculate} className="w-full">Calcular</Button>

        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`mt-6 rounded-xl p-6 border ${result.ok ? 'bg-success/10 border-success/30' : 'bg-destructive/10 border-destructive/30'}`}>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div><p className="text-xs text-muted-foreground">Horas de Voo</p><p className="text-xl font-bold text-foreground">{result.flightHours}h</p></div>
              <div><p className="text-xs text-muted-foreground">Jornada Total</p><p className="text-xl font-bold text-foreground">{result.dutyHours}h</p></div>
              <div><p className="text-xs text-muted-foreground">Limite ({crewType})</p><p className="text-xl font-bold text-foreground">{result.limit}h</p></div>
              <div><p className="text-xs text-muted-foreground">Período</p><p className="text-xl font-bold text-foreground capitalize">{result.period}</p></div>
            </div>
            <p className={`text-sm font-semibold ${result.ok ? 'text-success' : 'text-destructive'}`}>
              {result.ok ? '✅ Dentro do limite' : '⚠️ Jornada excede o limite'}
            </p>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
