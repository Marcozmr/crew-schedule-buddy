import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, BedDouble, CheckCircle2, Clock3, MoonStar, PlaneTakeoff, ShieldAlert, ShieldCheck, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumericInput } from '@/components/ui/numeric-input';
import { calculateDuty, calculateRest, checkSingleDuty, type DutyPeriodInput, type ScheduleWindow } from '@/regulation';
import { formatHoursMinutes } from '@/lib/date-utils';
import { mapAircraftCategory, mapCrewRole, timeToMinutes, toUtcIso } from '@/lib/operational-analysis';

interface OperationalCalculatorPanelProps {
  timezone: string;
  homeBase?: string | null;
}

interface ScenarioResult {
  dutyInput: DutyPeriodInput;
  compliance: ReturnType<typeof checkSingleDuty>;
  restToNextDuty: ReturnType<typeof calculateRest> | null;
}

function formatStatus(status: string): string {
  if (status === 'COMPLIANT') return 'Dentro dos limites';
  if (status === 'WARNING') return 'Atenção';
  return 'Crítico';
}

export function OperationalCalculatorPanel({ timezone, homeBase }: OperationalCalculatorPanelProps) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [operationDate, setOperationDate] = useState(today);
  const [reportTime, setReportTime] = useState('05:45');
  const [takeoffTime, setTakeoffTime] = useState('06:20');
  const [landingTime, setLandingTime] = useState('09:10');
  const [nextReportAt, setNextReportAt] = useState('');
  const [stages, setStages] = useState<number | null>(2);
  const [postFlightMinutes, setPostFlightMinutes] = useState<number | null>(30);
  const [crewRoleLabel, setCrewRoleLabel] = useState<'Comandante' | 'Copiloto' | 'Comissário'>('Comissário');
  const [baseAirport, setBaseAirport] = useState((homeBase || 'GRU').toUpperCase());
  const [departureAirport, setDepartureAirport] = useState((homeBase || 'GRU').toUpperCase());
  const [arrivalAirport, setArrivalAirport] = useState('BSB');
  const [aircraftType, setAircraftType] = useState('A320');
  const [error, setError] = useState('');
  const [result, setResult] = useState<ScenarioResult | null>(null);

  const handleCalculate = () => {
    setError('');
    if (!operationDate || !reportTime || !takeoffTime || !landingTime) {
      setError('Preencha data, apresentação, decolagem e pouso.');
      return;
    }

    const dayOffset = timeToMinutes(landingTime) < timeToMinutes(takeoffTime) ? 1 : 0;
    const dutyInput: DutyPeriodInput = {
      reportTimeUtc: toUtcIso(operationDate, reportTime, timezone),
      legs: [
        {
          id: 'manual-leg-1',
          flightNumber: 'SIM001',
          departureAirport: departureAirport.toUpperCase(),
          arrivalAirport: arrivalAirport.toUpperCase(),
          scheduledDepartureUtc: toUtcIso(operationDate, takeoffTime, timezone),
          scheduledArrivalUtc: toUtcIso(operationDate, landingTime, timezone, dayOffset),
          aircraftCategory: mapAircraftCategory(aircraftType),
          activityType: 'flight',
          crossesMidnight: dayOffset > 0,
        },
      ],
      baseAirport: baseAirport.toUpperCase(),
      crewRole: mapCrewRole(crewRoleLabel),
      aircraftCategory: mapAircraftCategory(aircraftType),
      postFlightMinutes: postFlightMinutes ?? 30,
    };

    const crew: ScheduleWindow['crew'] = {
      crewId: 'manual-scenario',
      crewRole: dutyInput.crewRole,
      baseAirport: dutyInput.baseAirport,
      aircraftCategory: dutyInput.aircraftCategory,
      airline: 'Operacional',
      timezone,
    };

    const compliance = checkSingleDuty(dutyInput, [], crew, dutyInput.reportTimeUtc);

    let restToNextDuty: ReturnType<typeof calculateRest> | null = null;
    if (nextReportAt) {
      const nextDutyInput: DutyPeriodInput = {
        reportTimeUtc: new Date(nextReportAt).toISOString(),
        legs: [],
        baseAirport: dutyInput.baseAirport,
        crewRole: dutyInput.crewRole,
        aircraftCategory: dutyInput.aircraftCategory,
        postFlightMinutes: 30,
      };
      const firstDuty = calculateDuty(dutyInput, timezone);
      const nextDuty = calculateDuty(nextDutyInput, timezone);
      restToNextDuty = calculateRest(1, [firstDuty, nextDuty], {
        dutyPeriods: [dutyInput, nextDutyInput],
        referenceDate: nextDutyInput.reportTimeUtc,
        crew,
      });
    }

    setResult({ dutyInput, compliance, restToNextDuty });
  };

  const currentDuty = result?.compliance.duty;
  const currentRest = result?.restToNextDuty;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] gap-6">
      <section className="glass p-5 lg:p-6 space-y-5 min-w-0">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground break-words">Cálculo operacional avançado</h2>
          <p className="text-sm text-muted-foreground mt-1 break-words">
            Simule a jornada com a mesma base usada no painel, nos alertas e no descanso.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 min-w-0">
            <Label className="text-[11px] text-muted-foreground">Data</Label>
            <Input type="date" value={operationDate} onChange={(event) => setOperationDate(event.target.value)} />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-[11px] text-muted-foreground">Trechos</Label>
            <NumericInput value={stages} onValueChange={setStages} min={1} max={8} decimals={0} blurDefault={1} />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-[11px] text-muted-foreground">Apresentação</Label>
            <Input type="time" value={reportTime} onChange={(event) => setReportTime(event.target.value)} />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-[11px] text-muted-foreground">Decolagem</Label>
            <Input type="time" value={takeoffTime} onChange={(event) => setTakeoffTime(event.target.value)} />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-[11px] text-muted-foreground">Pouso final</Label>
            <Input type="time" value={landingTime} onChange={(event) => setLandingTime(event.target.value)} />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-[11px] text-muted-foreground">Pós-voo (min)</Label>
            <NumericInput value={postFlightMinutes} onValueChange={setPostFlightMinutes} min={0} max={120} decimals={0} blurDefault={30} />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-[11px] text-muted-foreground">Minha base</Label>
            <Input value={baseAirport} onChange={(event) => setBaseAirport(event.target.value.toUpperCase())} maxLength={4} />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-[11px] text-muted-foreground">Origem</Label>
            <Input value={departureAirport} onChange={(event) => setDepartureAirport(event.target.value.toUpperCase())} maxLength={4} />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-[11px] text-muted-foreground">Destino</Label>
            <Input value={arrivalAirport} onChange={(event) => setArrivalAirport(event.target.value.toUpperCase())} maxLength={4} />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-[11px] text-muted-foreground">Aeronave</Label>
            <Input value={aircraftType} onChange={(event) => setAircraftType(event.target.value.toUpperCase())} />
          </div>
          <div className="sm:col-span-2 space-y-1.5 min-w-0">
            <Label className="text-[11px] text-muted-foreground">Próxima apresentação (opcional)</Label>
            <Input type="datetime-local" value={nextReportAt} onChange={(event) => setNextReportAt(event.target.value)} />
          </div>
        </div>

        <div className="space-y-2 min-w-0">
          <Label className="text-[11px] text-muted-foreground">Função</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(['Comandante', 'Copiloto', 'Comissário'] as const).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setCrewRoleLabel(role)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors break-words ${
                  crewRoleLabel === role ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-start gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="break-words">{error}</span>
          </div>
        )}

        <Button onClick={handleCalculate} className="w-full h-11">
          <ShieldCheck className="w-4 h-4 mr-2 shrink-0" />
          Calcular jornada
        </Button>
      </section>

      <section className="space-y-4 min-w-0">
        {!result || !currentDuty ? (
          <div className="glass p-6 sm:p-8 min-h-[320px] flex items-center justify-center text-center">
            <div className="min-w-0">
              <ShieldAlert className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground break-words">Preencha os horários para calcular jornada, descanso e situação operacional.</p>
            </div>
          </div>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass p-5 min-w-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-w-0">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Situação operacional</p>
                  <h3 className="text-xl font-semibold text-foreground mt-1 break-words">{formatStatus(result.compliance.status)}</h3>
                  <p className="text-[11px] text-muted-foreground mt-1 break-words">{result.compliance.alerts[0]?.message || 'Baseado na jornada atual e acumulados recentes.'}</p>
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${result.compliance.status === 'COMPLIANT' ? 'bg-success/10 text-success' : result.compliance.status === 'WARNING' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                  {result.compliance.status === 'COMPLIANT' ? 'Dentro do limite' : result.compliance.status === 'WARNING' ? 'Próximo do limite' : 'Limite violado'}
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
              <div className="glass p-5 min-w-0">
                <p className="text-xs text-muted-foreground flex items-center gap-2"><Clock3 className="w-4 h-4 text-primary shrink-0" /> Jornada</p>
                <p className="text-xl sm:text-2xl font-semibold text-foreground mt-2 break-words">{formatHoursMinutes(currentDuty.totalDutyHours)}</p>
                <p className="text-xs text-muted-foreground mt-1 break-words">Começa na apresentação e termina após o pós-voo.</p>
              </div>
              <div className="glass p-5 min-w-0">
                <p className="text-xs text-muted-foreground flex items-center gap-2"><PlaneTakeoff className="w-4 h-4 text-primary shrink-0" /> Tempo de voo</p>
                <p className="text-xl sm:text-2xl font-semibold text-foreground mt-2 break-words">{formatHoursMinutes(currentDuty.totalFlightHours)}</p>
                <p className="text-xs text-muted-foreground mt-1 break-words">Trechos considerados: {result.dutyInput.legs.length}</p>
              </div>
              <div className="glass p-5 min-w-0">
                <p className="text-xs text-muted-foreground flex items-center gap-2"><Timer className="w-4 h-4 text-primary shrink-0" /> Fim da jornada</p>
                <p className="text-xl sm:text-2xl font-semibold text-foreground mt-2 whitespace-nowrap">{currentDuty.endTimeLocal.slice(11, 16)}</p>
                <p className="text-xs text-muted-foreground mt-1 break-words">Pouso final + {currentDuty.postFlightMinutes} min de pós-voo.</p>
              </div>
              <div className="glass p-5 min-w-0">
                <p className="text-xs text-muted-foreground flex items-center gap-2"><BedDouble className="w-4 h-4 text-primary shrink-0" /> Início do descanso</p>
                <p className="text-xl sm:text-2xl font-semibold text-foreground mt-2 whitespace-nowrap">{currentDuty.endTimeLocal.slice(11, 16)}</p>
                <p className="text-xs text-muted-foreground mt-1 break-words">O descanso começa somente após o término operacional.</p>
              </div>
              <div className="glass p-5 min-w-0">
                <p className="text-xs text-muted-foreground flex items-center gap-2"><MoonStar className="w-4 h-4 text-primary shrink-0" /> Período noturno</p>
                <p className="text-base font-semibold text-foreground mt-2 break-words">
                  {result.compliance.fatigue.woclExposure.totalMinutes > 0 ? 'Operação em período noturno' : 'Sem operação em período noturno'}
                </p>
                <p className="text-xs text-muted-foreground mt-1 break-words">{currentDuty.isMadrugadaDuty ? 'A jornada toca a faixa de madrugada.' : 'Sem operação em madrugada.'}</p>
              </div>
              <div className="glass p-5 min-w-0">
                <p className="text-xs text-muted-foreground flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary shrink-0" /> Repouso até a próxima apresentação</p>
                <p className="text-xl sm:text-2xl font-semibold text-foreground mt-2 break-words">{currentRest?.restBeforeDutyHours != null ? formatHoursMinutes(currentRest.restBeforeDutyHours) : '—'}</p>
                <p className="text-xs text-muted-foreground mt-1 break-words">
                  {currentRest ? `Mínimo exigido: ${formatHoursMinutes(currentRest.minRequiredRestHours)}${currentRest.augmentedRest ? ' (fora da base)' : ''}` : 'Informe a próxima apresentação para validar o descanso.'}
                </p>
              </div>
            </div>

            <div className="glass p-5 min-w-0">
              <h3 className="text-sm font-semibold text-foreground mb-3">Alertas operacionais</h3>
              <div className="space-y-2 min-w-0">
                {result.compliance.alerts.length > 0 ? result.compliance.alerts.map((alert) => (
                  <div key={`${alert.ruleId}-${alert.message}`} className="rounded-xl bg-muted/60 px-3 py-2 text-sm min-w-0">
                    <p className="font-medium text-foreground break-words">{alert.message}</p>
                  </div>
                )) : (
                  <div className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success flex items-start gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 shrink-0" /> <span className="break-words">Nenhum alerta relevante nesta simulação.</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
