/**
 * EscalaX — Cálculo de Jornada RBAC 117
 * Premium aviation-style duty calculator with full audit trail.
 */

import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumericInput } from '@/components/ui/numeric-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Shield, Plane, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, FileText, Users, User, Gauge, Timer, ArrowRight, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { calculateDuty, type DutyCalcInput, type DutyCalcResult, type CrewRole, type CrewType, type AircraftCategory, FLIGHT_LIMITS } from '@/services/duty-calc-service';

export default function DutyCalcPage() {
  const [report, setReport] = useState('');
  const [takeoff, setTakeoff] = useState('');
  const [landing, setLanding] = useState('');
  const [stages, setStages] = useState<number | null>(2);
  const [crewRole, setCrewRole] = useState<CrewRole>('comissario');
  const [crewType, setCrewType] = useState<CrewType>('simples');
  const [aircraftType, setAircraftType] = useState<AircraftCategory>('narrowbody');
  const [postFlight, setPostFlight] = useState<number | null>(30);
  const [result, setResult] = useState<DutyCalcResult | null>(null);
  const [showAudit, setShowAudit] = useState(false);
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
      aircraftCategory: aircraftType,
      postFlightMinutes: postFlight ?? 30,
    };

    setResult(calculateDuty(input));
  };

  const flightLimit28d = aircraftType === 'widebody' ? FLIGHT_LIMITS['28days_widebody'] : FLIGHT_LIMITS['28days_narrowbody'];

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto pb-12 px-4">

        {/* ═══ BLOCK 1 — Hero Header ═══ */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="pt-2 pb-8 text-center"
        >
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl gradient-sky flex items-center justify-center shadow-glow-blue">
            <Gauge className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Cálculo de Jornada
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            RBAC 117 · Tabela 4, Apêndice B — Limites auditáveis
          </p>
        </motion.div>

        {/* ═══ BLOCK 2 — Dados da Operação ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="glass-elevated rounded-2xl p-6 mb-5 shadow-card"
        >
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Plane className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Dados da Operação</h2>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground/80">Apresentação</Label>
              <Input type="time" value={report} onChange={e => setReport(e.target.value)}
                className="font-mono text-base h-11 bg-secondary/50 border-border/50 focus:border-primary/60 focus:ring-1 focus:ring-primary/30" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground/80">Decolagem</Label>
              <Input type="time" value={takeoff} onChange={e => setTakeoff(e.target.value)}
                className="font-mono text-base h-11 bg-secondary/50 border-border/50 focus:border-primary/60 focus:ring-1 focus:ring-primary/30" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground/80">Pouso (último trecho)</Label>
              <Input type="time" value={landing} onChange={e => setLanding(e.target.value)}
                className="font-mono text-base h-11 bg-secondary/50 border-border/50 focus:border-primary/60 focus:ring-1 focus:ring-primary/30" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground/80">Etapas (legs)</Label>
              <NumericInput value={stages} onValueChange={setStages} min={1} max={20} decimals={0} blurDefault={1}
                className="h-11 bg-secondary/50 border-border/50" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground/80 flex items-center gap-1.5">
                <Timer className="w-3 h-3" /> Pós-voo / Corte de motor (min)
              </Label>
              <NumericInput value={postFlight} onValueChange={setPostFlight} min={0} max={120} decimals={0} blurDefault={30}
                className="h-11 bg-secondary/50 border-border/50" />
            </div>
          </div>
        </motion.section>

        {/* ═══ BLOCK 3 — Classificação Operacional ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="glass-elevated rounded-2xl p-6 mb-5 shadow-card"
        >
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
              <Users className="w-4 h-4 text-accent" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Classificação Operacional</h2>
          </div>

          <div className="space-y-4">
            {/* Função - chips style */}
            <div className="space-y-2">
              <Label className="text-[11px] font-medium text-muted-foreground/80 flex items-center gap-1.5">
                <User className="w-3 h-3" /> Função
              </Label>
              <div className="flex gap-2">
                {(['piloto', 'comissario'] as CrewRole[]).map(role => (
                  <button
                    key={role}
                    onClick={() => setCrewRole(role)}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${
                      crewRole === role
                        ? 'gradient-sky text-primary-foreground shadow-glow-blue'
                        : 'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    {role === 'piloto' ? 'Piloto' : 'Comissário(a)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Tripulação - chips */}
            <div className="space-y-2">
              <Label className="text-[11px] font-medium text-muted-foreground/80">Tripulação</Label>
              <div className="flex gap-2">
                {([
                  { v: 'simples' as CrewType, l: 'Simples', s: '2 pilotos' },
                  { v: 'composta' as CrewType, l: 'Composta', s: '+3h' },
                  { v: 'revezamento' as CrewType, l: 'Revezam.', s: '+6h' },
                ]).map(ct => (
                  <button
                    key={ct.v}
                    onClick={() => setCrewType(ct.v)}
                    className={`flex-1 py-2.5 px-2 rounded-xl text-center transition-all ${
                      crewType === ct.v
                        ? 'gradient-sky text-primary-foreground shadow-glow-blue'
                        : 'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    <span className="text-sm font-semibold block">{ct.l}</span>
                    <span className="text-[10px] opacity-70">{ct.s}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Aeronave */}
            <div className="space-y-2">
              <Label className="text-[11px] font-medium text-muted-foreground/80">Tipo de Aeronave</Label>
              <div className="flex gap-2">
                {([
                  { v: 'narrowbody' as AircraftCategory, l: 'Narrowbody', s: `≤${FLIGHT_LIMITS['28days_narrowbody']}h/28d` },
                  { v: 'widebody' as AircraftCategory, l: 'Widebody', s: `≤${FLIGHT_LIMITS['28days_widebody']}h/28d` },
                ]).map(ac => (
                  <button
                    key={ac.v}
                    onClick={() => setAircraftType(ac.v)}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-center transition-all ${
                      aircraftType === ac.v
                        ? 'gradient-sky text-primary-foreground shadow-glow-blue'
                        : 'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    <span className="text-sm font-semibold block">{ac.l}</span>
                    <span className="text-[10px] opacity-70">{ac.s}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Error */}
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-destructive mb-3 px-1 flex items-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5" /> {error}
          </motion.p>
        )}

        {/* Calculate CTA */}
        <Button onClick={calculate} size="lg"
          className="w-full h-14 text-base font-bold gradient-sky text-primary-foreground rounded-2xl shadow-glow-blue hover:shadow-elevated transition-all mb-8"
        >
          <Shield className="w-5 h-5 mr-2" /> Calcular Jornada
        </Button>

        {/* ═══ BLOCK 4 — Resultado Principal ═══ */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              {/* Status Banner */}
              <div className={`rounded-2xl p-6 border-2 shadow-card ${
                result.overallCompliant
                  ? 'border-success/30 bg-success/5'
                  : 'border-destructive/30 bg-destructive/5'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  {result.overallCompliant
                    ? <div className="w-12 h-12 rounded-2xl bg-success/20 flex items-center justify-center">
                        <CheckCircle className="w-7 h-7 text-success" />
                      </div>
                    : <div className="w-12 h-12 rounded-2xl bg-destructive/20 flex items-center justify-center">
                        <AlertTriangle className="w-7 h-7 text-destructive" />
                      </div>
                  }
                  <div>
                    <p className={`text-lg font-extrabold ${result.overallCompliant ? 'text-success' : 'text-destructive'}`}>
                      {result.overallCompliant ? 'DENTRO DO LIMITE' : 'EXCEDE LIMITE'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {result.periodDetail}
                      {result.isWOCL && ' · WOCL 02–06'}
                      {result.isMadrugada && !result.isWOCL && ' · Madrugada'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Duty & Flight — two prominent metric cards */}
              <div className="grid grid-cols-2 gap-4">
                {/* Jornada */}
                <div className="glass-elevated rounded-2xl p-5 shadow-card">
                  <div className="flex items-center gap-1.5 mb-3">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Jornada</span>
                  </div>
                  <p className={`text-3xl font-extrabold font-mono ${result.dutyWithinLimit ? 'text-foreground' : 'text-destructive'}`}>
                    {result.dutyHours}h
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span>Limite</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                    <span className="font-bold text-foreground">{result.effectiveDutyLimit}h</span>
                    {result.crewExtensionDuty > 0 && (
                      <span className="text-primary">({result.baseDutyLimit}+{result.crewExtensionDuty})</span>
                    )}
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        !result.dutyWithinLimit ? 'bg-destructive' :
                        result.dutyHours / result.effectiveDutyLimit > 0.85 ? 'bg-warning' : 'bg-success'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((result.dutyHours / result.effectiveDutyLimit) * 100, 100)}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </div>

                {/* Horas Voo */}
                <div className="glass-elevated rounded-2xl p-5 shadow-card">
                  <div className="flex items-center gap-1.5 mb-3">
                    <Plane className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Horas Voo</span>
                  </div>
                  <p className={`text-3xl font-extrabold font-mono ${result.flightWithinLimit ? 'text-foreground' : 'text-destructive'}`}>
                    {result.flightHours}h
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span>Limite</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                    <span className="font-bold text-foreground">{result.effectiveFlightLimit}h</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        !result.flightWithinLimit ? 'bg-destructive' :
                        result.flightHours / result.effectiveFlightLimit > 0.85 ? 'bg-warning' : 'bg-success'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((result.flightHours / result.effectiveFlightLimit) * 100, 100)}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              </div>

              {/* Término */}
              <div className="glass rounded-2xl px-5 py-4 flex items-center justify-between shadow-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Timer className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Término da Jornada</p>
                    <p className="text-xs text-muted-foreground">{result.period} · {result.tableLegsBucket} etapas</p>
                  </div>
                </div>
                <p className="text-2xl font-extrabold font-mono text-foreground">{result.endOfDutyTime}</p>
              </div>

              {/* 28-day limit */}
              <div className="glass rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Limite 28 dias ({aircraftType === 'widebody' ? 'Widebody' : 'Narrowbody'})
                </span>
                <span className="text-sm font-bold font-mono text-foreground">{flightLimit28d}h</span>
              </div>

              {/* ═══ BLOCK 5 — Memória de Cálculo ═══ */}
              <div className="glass-elevated rounded-2xl overflow-hidden shadow-card">
                <button
                  onClick={() => setShowAudit(!showAudit)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-secondary/20 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-foreground">Memória de Cálculo</p>
                      <p className="text-[10px] text-muted-foreground">Auditoria passo a passo</p>
                    </div>
                  </div>
                  {showAudit ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                </button>

                <AnimatePresence>
                  {showAudit && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5">
                        <div className="space-y-0 border-l-2 border-primary/20 ml-4">
                          {result.audit.map((step, i) => (
                            <div key={i} className="relative pl-5 py-2 group">
                              {/* Timeline dot */}
                              <div className="absolute -left-[5px] top-3 w-2 h-2 rounded-full bg-primary/60 group-hover:bg-primary transition-colors" />
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-[11px] text-muted-foreground">{step.label}</span>
                                <span className="text-xs font-mono font-bold text-foreground shrink-0">{step.value}</span>
                              </div>
                              {step.detail && (
                                <p className="text-[10px] text-muted-foreground/60 mt-0.5">{step.detail}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ═══ BLOCK 6 — Referência Regulatória ═══ */}
              <div className="glass rounded-2xl p-5 shadow-card">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-accent" />
                  </div>
                  <h3 className="text-xs font-bold text-foreground">Referências RBAC 117</h3>
                </div>
                <div className="space-y-2 text-[11px] text-muted-foreground leading-relaxed">
                  <p>• <span className="text-foreground/80 font-medium">Tabela 4, Apêndice B</span> — Limites de jornada por hora de apresentação e número de etapas</p>
                  <p>• <span className="text-foreground/80 font-medium">§117.71</span> — Extensões: Composta (+3h jornada, +2h voo) · Revezamento (+6h jornada, +3h voo)</p>
                  <p>• <span className="text-foreground/80 font-medium">§117.63</span> — Acumulados: {FLIGHT_LIMITS['30days']}h/30d · {FLIGHT_LIMITS['7days']}h/7d · {FLIGHT_LIMITS['90days']}h/90d · {FLIGHT_LIMITS['365days']}h/ano</p>
                  <p>• <span className="text-foreground/80 font-medium">WOCL 02:00–06:00</span> — Janela crítica de fadiga com gestão adicional requerida</p>
                  <p>• <span className="text-foreground/80 font-medium">Pós-voo</span> — Padrão 30 min (configurável), incluído na jornada total</p>
                </div>
                <div className="mt-4 pt-3 border-t border-border/30">
                  <p className="text-[10px] text-muted-foreground/50">
                    Ferramenta auxiliar. Consulte sempre a documentação oficial da ANAC para decisões operacionais.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
