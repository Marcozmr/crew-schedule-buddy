import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BedDouble, ShieldCheck, ShieldX } from 'lucide-react';
import { motion } from 'framer-motion';

const MIN_REST = 12;

export default function RestCalcPage() {
  const [endDuty, setEndDuty] = useState('');
  const [nextReport, setNextReport] = useState('');
  const [result, setResult] = useState<{ hours: number; minutes: number; ok: boolean } | null>(null);

  const calculate = () => {
    if (!endDuty || !nextReport) return;
    const end = new Date(endDuty);
    const start = new Date(nextReport);
    const diffMs = start.getTime() - end.getTime();
    if (diffMs < 0) { setResult({ hours: 0, minutes: 0, ok: false }); return; }
    const h = Math.floor(diffMs / 3600000);
    const m = Math.round((diffMs % 3600000) / 60000);
    setResult({ hours: h, minutes: m, ok: h + m / 60 >= MIN_REST });
  };

  return (
    <AppLayout>
      <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
        <BedDouble className="w-6 h-6 text-primary" />Cálculo de Descanso
      </motion.h1>

      <div className="bg-card rounded-xl p-6 shadow-card mb-6 border border-border max-w-lg">
        <p className="text-xs text-muted-foreground mb-4">Todos os horários em America/Sao_Paulo (BRT)</p>
        <div className="space-y-4">
          <div>
            <Label>Fim da Jornada</Label>
            <Input type="datetime-local" value={endDuty} onChange={e => setEndDuty(e.target.value)} />
          </div>
          <div>
            <Label>Próxima Apresentação</Label>
            <Input type="datetime-local" value={nextReport} onChange={e => setNextReport(e.target.value)} />
          </div>
          <Button onClick={calculate} className="w-full">Calcular</Button>
        </div>

        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`mt-6 rounded-xl p-6 border ${result.ok ? 'bg-success/10 border-success/30' : 'bg-destructive/10 border-destructive/30'}`}>
            <div className="flex items-center gap-3 mb-2">
              {result.ok ? <ShieldCheck className="w-6 h-6 text-success" /> : <ShieldX className="w-6 h-6 text-destructive" />}
              <p className="font-bold text-foreground text-lg">{result.hours}h{result.minutes.toString().padStart(2, '0')}m</p>
            </div>
            <p className="text-sm text-muted-foreground">Mínimo exigido: {MIN_REST}h</p>
            <p className={`text-sm font-semibold mt-1 ${result.ok ? 'text-success' : 'text-destructive'}`}>
              {result.ok ? '✅ Descanso suficiente' : '⚠️ Descanso insuficiente'}
            </p>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
