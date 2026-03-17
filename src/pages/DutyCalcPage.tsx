/**
 * EscalaX — Cálculo de Jornada (Premium Light)
 */

import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumericInput } from '@/components/ui/numeric-input';
import { Clock, Shield, Plane, AlertTriangle, CheckCircle, Users, User, Timer, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { calculateDuty, type DutyCalcInput, type DutyCalcResult, type CrewRole, type CrewType } from '@/services/duty-calc-service';

export default function DutyCalcPage() {
  const [report, setReport] = useState('');
  const [takeoff, setTakeoff] = useState('');
  const [landing, setLanding] = useState('');
  const [stages, setStages] = useState<number | null>(2);
  const [crewRole, setCrewRole] = useState<CrewRole>('comissario');
  const [crewType, setCrewType] = useState<CrewType>('simples');
  const [postFlight, setPostFlight] = useState<number | null>(30);
  const [result, setResult] = useState<DutyCalcResult | null>(null);
  const [error, setError] = useState('');

  const calculate = () => {
    setError('');
    if (!report) { setError('Informe o horário de apresentação'); return; }
    if (!takeoff) { setError('Informe o horário de decolagem'); return; }
    if (!landing) { setError('Informe o horário de pouso'); return; }

    const input: DutyCalcInput = {
      reportTime: report,
      takeoffTime: takeoff,
      landingTime: landing,
      legs: stages ?? 1,
      crewRole,
      crewType,
      aircraftCategory: 'narrowbody',
      postFlightMinutes: postFlight ?? 30,
    };

    setResult(calculateDuty(input));
  };

  return (
    <AppLayout>
      <div className="pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

          {/* LEFT: Form */}
          <div className="lg:col-span-5 space-y-5">

            <motion.section
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04, duration: 0.3 }}
              className="glass p-5 lg:p-6"
            >
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5">
                Dados da Operação
              </h2>

              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Apresentação</Label>
                  <Input type="time" value={report} onChange={e => setReport(e.target.value)}
                    className="font-mono text-sm h-10 bg-secondary/50 border-border focus:border-primary focus:ring-1 focus:ring-primary/20" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Decolagem</Label>
                  <Input type="time" value={takeoff} onChange={e => setTakeoff(e.target.value)}
                    className="font-mono text-sm h-10 bg-secondary/50 border-border focus:border-primary focus:ring-1 focus:ring-primary/20" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Pouso</Label>
                  <Input type="time" value={landing} onChange={e => setLanding(e.target.value)}
                    className="font-mono text-sm h-10 bg-secondary/50 border-border focus:border-primary focus:ring-1 focus:ring-primary/20" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Etapas</Label>
                  <NumericInput value={stages} onValueChange={setStages} min={1} max={20} decimals={0} blurDefault={1}
                    className="h-10 bg-secondary/50 border-border" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Timer className="w-3 h-3" /> Pós-voo (min)
                  </Label>
                  <NumericInput value={postFlight} onValueChange={setPostFlight} min={0} max={120} decimals={0} blurDefault={30}
                    className="h-10 bg-secondary/50 border-border" />
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.3 }}
              className="glass p-5 lg:p-6"
            >
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5">
                Classificação
              </h2>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <User className="w-3 h-3" /> Função
                  </Label>
                  <div className="flex gap-2">
                    {(['piloto', 'comissario'] as CrewRole[]).map(role => (
                      <button key={role} onClick={() => setCrewRole(role)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                          crewRole === role
                            ? 'bg-primary text-primary-foreground shadow-glow-blue'
                            : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
                        }`}>
                        {role === 'piloto' ? 'Piloto' : 'Comissário(a)'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Users className="w-3 h-3" /> Tripulação
                  </Label>
                  <div className="flex gap-2">
                    {([
                      { v: 'simples' as CrewType, l: 'Simples' },
                      { v: 'composta' as CrewType, l: 'Composta' },
                      { v: 'revezamento' as CrewType, l: 'Revezamento' },
                    ]).map(ct => (
                      <button key={ct.v} onClick={() => setCrewType(ct.v)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                          crewType === ct.v
                            ? 'bg-primary text-primary-foreground shadow-glow-blue'
                            : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
                        }`}>
                        {ct.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>

            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-sm text-destructive flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> {error}
              </motion.p>
            )}

            <Button onClick={calculate} size="lg"
              className="w-full h-12 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-glow-blue hover:scale-[1.01] transition-all duration-200">
              <Shield className="w-4 h-4 mr-2" /> Calcular Jornada
            </Button>
          </div>

          {/* RIGHT: Results */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4 lg:sticky lg:top-24"
                >
                  {/* Status */}
                  <div className={`glass p-5 border-l-4 ${
                    result.overallCompliant ? 'border-l-success' : 'border-l-destructive'
                  }`}>
                    <div className="flex items-center gap-3">
                      {result.overallCompliant
                        ? <CheckCircle className="w-6 h-6 text-success shrink-0" />
                        : <AlertTriangle className="w-6 h-6 text-destructive shrink-0" />
                      }
                      <div>
                        <p className={`text-base font-semibold ${result.overallCompliant ? 'text-success' : 'text-destructive'}`}>
                          {result.overallCompliant ? 'Dentro do limite' : 'Excede o limite'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {result.periodDetail}
                          {result.isWOCL && ' · WOCL 02–06'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass p-5">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[11px] text-muted-foreground font-medium">Jornada</span>
                      </div>
                      <p className={`text-3xl font-semibold font-mono ${result.dutyWithinLimit ? 'text-foreground' : 'text-destructive'}`}>
                        {result.dutyHours}h
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>Limite</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                        <span className="font-medium text-foreground">{result.effectiveDutyLimit}h</span>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${
                            !result.dutyWithinLimit ? 'bg-destructive' :
                            result.dutyHours / result.effectiveDutyLimit > 0.85 ? 'bg-warning' : 'bg-success'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((result.dutyHours / result.effectiveDutyLimit) * 100, 100)}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                    </div>

                    <div className="glass p-5">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Plane className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[11px] text-muted-foreground font-medium">Horas de voo</span>
                      </div>
                      <p className={`text-3xl font-semibold font-mono ${result.flightWithinLimit ? 'text-foreground' : 'text-destructive'}`}>
                        {result.flightHours}h
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>Limite</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                        <span className="font-medium text-foreground">{result.effectiveFlightLimit}h</span>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${
                            !result.flightWithinLimit ? 'bg-destructive' :
                            result.flightHours / result.effectiveFlightLimit > 0.85 ? 'bg-warning' : 'bg-success'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((result.flightHours / result.effectiveFlightLimit) * 100, 100)}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Término */}
                  <div className="glass px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Timer className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-[11px] text-muted-foreground font-medium">Término da jornada</p>
                        <p className="text-xs text-muted-foreground">{result.period} · {result.tableLegsBucket} etapas</p>
                      </div>
                    </div>
                    <p className="text-2xl font-semibold font-mono text-foreground">{result.endOfDutyTime}</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hidden lg:flex flex-col items-center justify-center h-full min-h-[300px] text-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                    <Clock className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Preencha os dados e clique em Calcular
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
