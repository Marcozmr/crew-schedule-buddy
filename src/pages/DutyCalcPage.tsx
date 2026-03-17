/**
 * EscalaX — Cálculo de Jornada RBAC 117
 * Professional duty calculator with full audit trail.
 */

import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumericInput } from '@/components/ui/numeric-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Shield, Plane, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, FileText, Users, User } from 'lucide-react';
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
      <div className="max-w-lg mx-auto pb-8">
        {/* Page Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl gradient-sky flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Cálculo de Jornada</h1>
              <p className="text-xs text-muted-foreground">RBAC 117 • Tabela 4, Apêndice B</p>
            </div>
          </div>
        </motion.div>

        {/* ─── BLOCK 1: Operation Data ─── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="glass rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Plane className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Dados da Operação</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Apresentação</Label>
              <Input type="time" value={report} onChange={e => setReport(e.target.value)} className="font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Etapas</Label>
              <NumericInput value={stages} onValueChange={setStages} min={1} max={20} decimals={0} blurDefault={1} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Decolagem</Label>
              <Input type="time" value={takeoff} onChange={e => setTakeoff(e.target.value)} className="font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Pouso (último)</Label>
              <Input type="time" value={landing} onChange={e => setLanding(e.target.value)} className="font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                Pós-voo (min)
              </Label>
              <NumericInput value={postFlight} onValueChange={setPostFlight} min={0} max={120} decimals={0} blurDefault={30} />
            </div>
          </div>
        </motion.div>

        {/* ─── BLOCK 2: Classification ─── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Classificação Operacional</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="w-3 h-3" /> Função
              </Label>
              <Select value={crewRole} onValueChange={v => setCrewRole(v as CrewRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="piloto">Piloto</SelectItem>
                  <SelectItem value="comissario">Comissário(a)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Tripulação</Label>
              <Select value={crewType} onValueChange={v => setCrewType(v as CrewType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="simples">Simples (2 pilotos)</SelectItem>
                  <SelectItem value="composta">Composta (3 pilotos)</SelectItem>
                  <SelectItem value="revezamento">Revezamento (4 pilotos)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground">Tipo Aeronave</Label>
              <Select value={aircraftType} onValueChange={v => setAircraftType(v as AircraftCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="narrowbody">Narrowbody (≤{FLIGHT_LIMITS['28days_narrowbody']}h/28d)</SelectItem>
                  <SelectItem value="widebody">Widebody (≤{FLIGHT_LIMITS['28days_widebody']}h/28d)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </motion.div>

        {/* Calculate button */}
        {error && <p className="text-xs text-destructive mb-2 px-1">{error}</p>}
        <Button onClick={calculate} className="w-full gradient-sky text-primary-foreground font-semibold mb-6" size="lg">
          <Shield className="w-4 h-4 mr-2" /> Calcular Jornada
        </Button>

        {/* ─── BLOCK 3: Result ─── */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Overall status banner */}
              <div className={`rounded-2xl p-5 border-2 ${result.overallCompliant ? 'border-success/40 bg-success/5' : 'border-destructive/40 bg-destructive/5'}`}>
                <div className="flex items-center gap-3 mb-2">
                  {result.overallCompliant
                    ? <CheckCircle className="w-6 h-6 text-success" />
                    : <AlertTriangle className="w-6 h-6 text-destructive" />}
                  <span className={`text-lg font-bold ${result.overallCompliant ? 'text-success' : 'text-destructive'}`}>
                    {result.overallCompliant ? 'DENTRO DO LIMITE RBAC' : 'EXCEDE LIMITE RBAC'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Período: <span className="text-foreground font-medium">{result.period}</span></span>
                  {result.isWOCL && <span className="text-destructive font-bold">⚠ WOCL 02:00–06:00</span>}
                  {result.isMadrugada && !result.isWOCL && <span className="text-warning font-bold">⚠ Madrugada</span>}
                </div>
              </div>

              {/* Duty card */}
              <div className="glass rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Jornada</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Jornada</p>
                    <p className={`text-2xl font-bold font-mono ${result.dutyWithinLimit ? 'text-foreground' : 'text-destructive'}`}>{result.dutyHours}h</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Limite RBAC</p>
                    <p className="text-2xl font-bold font-mono text-foreground">{result.effectiveDutyLimit}h</p>
                    {result.crewExtensionDuty > 0 && (
                      <p className="text-[9px] text-muted-foreground">{result.baseDutyLimit}h + {result.crewExtensionDuty}h</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Término</p>
                    <p className="text-2xl font-bold font-mono text-foreground">{result.endOfDutyTime}</p>
                  </div>
                </div>
                <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${!result.dutyWithinLimit ? 'bg-destructive' : result.dutyHours / result.effectiveDutyLimit > 0.85 ? 'bg-warning' : 'bg-success'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((result.dutyHours / result.effectiveDutyLimit) * 100, 100)}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
              </div>

              {/* Flight card */}
              <div className="glass rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Plane className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Horas de Voo</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Horas Voo</p>
                    <p className={`text-xl font-bold font-mono ${result.flightWithinLimit ? 'text-foreground' : 'text-destructive'}`}>{result.flightHours}h</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Limite Voo</p>
                    <p className="text-xl font-bold font-mono text-foreground">{result.effectiveFlightLimit}h</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">28d ({aircraftType === 'widebody' ? 'WB' : 'NB'})</p>
                    <p className="text-xl font-bold font-mono text-foreground">{flightLimit28d}h</p>
                  </div>
                </div>
              </div>

              {/* ─── BLOCK 4: Audit Trail ─── */}
              <div className="glass rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowAudit(!showAudit)}
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Memória de Cálculo</span>
                  </div>
                  {showAudit ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>

                <AnimatePresence>
                  {showAudit && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-5 pb-4 space-y-1">
                        {result.audit.map((step, i) => (
                          <div key={i} className="flex items-baseline gap-2 py-1.5 border-b border-border/30 last:border-0">
                            <span className="text-[10px] text-muted-foreground min-w-[140px] shrink-0">{step.label}</span>
                            <span className="text-xs font-mono font-bold text-foreground">{step.value}</span>
                            {step.detail && <span className="text-[10px] text-muted-foreground/70">{step.detail}</span>}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ─── BLOCK 5: Regulation Notes ─── */}
              <div className="rounded-xl bg-muted/50 p-4 text-[10px] text-muted-foreground space-y-1.5">
                <p className="font-bold text-foreground text-xs mb-2">Referências RBAC 117</p>
                <p>• Tabela 4, Apêndice B — Limites de jornada por hora de apresentação e etapas</p>
                <p>• §117.71 — Extensões para tripulação composta (+3h jornada) e revezamento (+6h jornada)</p>
                <p>• §117.63 — Limite mensal: {FLIGHT_LIMITS['30days']}h / 7 dias: {FLIGHT_LIMITS['7days']}h</p>
                <p>• WOCL (02:00–06:00): janela crítica de fadiga — requer gestão adicional</p>
                <p>• Pós-voo padrão: 30 min (configurável acima)</p>
                <p className="text-[9px] text-muted-foreground/50 pt-1">Este cálculo é uma ferramenta auxiliar. Consulte sempre a documentação oficial da ANAC.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
