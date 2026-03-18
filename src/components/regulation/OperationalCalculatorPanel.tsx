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
    <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6">
      <section className="glass p-5 lg:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Cálculo operacional avançado</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Simule a jornada com a mesma base usada no painel, nos alertas e no descanso.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Data</Label>
            <Input type="date" value={operationDate} onChange={(event) => setOperationDate(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Trechos</Label>
            <NumericInput value={stages} onValueChange={setStages} min={1} max={8} decimals={0} blurDefault={1} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Apresentação</Label>
            <Input type="time" value={reportTime} onChange={(event) => setReportTime(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Decolagem</Label>
            <Input type="time" value={takeoffTime} onChange={(event) => setTakeoffTime(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Pouso final</Label>
            <Input type="time" value={landingTime} onChange={(event) => setLandingTime(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Pós-voo (min)</Label>
            <NumericInput value={postFlightMinutes} onValueChange={setPostFlightMinutes} min={0} max={120} decimals={0} blurDefault={30} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Base</Label>
            <Input value={baseAirport} onChange={(event) => setBaseAirport(event.target.value.toUpperCase())} maxLength={4} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Origem</Label>
            <Input value={departureAirport} onChange={(event) => setDepartureAirport(event.target.value.toUpperCase())} maxLength={4} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Destino</Label>
            <Input value={arrivalAirport} onChange={(event) => setArrivalAirport(event.target.value.toUpperCase())} maxLength={4} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Aeronave</Label>
            <Input value={aircraftType} onChange={(event) => setAircraftType(event.target.value.toUpperCase())} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Próxima apresentação (opcional)</Label>
            <Input type="datetime-local" value={nextReportAt} onChange={(event) => setNextReportAt(event.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[11px] text-muted-foreground">Função</Label>
          <div className="grid grid-cols-3 gap-2">
            {(['Comandante', 'Copiloto', 'Comissário'] as const).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setCrewRoleLabel(role)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  crewRoleLabel === role ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button onClick={handleCalculate} className="w-full h-11">
          <ShieldCheck className="w-4 h-4 mr-2" />
          Calcular jornada
        </Button>
      </section>

      <section className="space-y-4">
        {!result || !currentDuty ? (
          <div className="glass p-8 min-h-[320px] flex items-center justify-center text-center">
            <div>
              <ShieldAlert className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Preencha os horários para calcular jornada, descanso e situação operacional.</p>
            </div>
          </div>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Status operacional</p>
                  <h3 className="text-xl font-semibold text-foreground mt-1">{formatStatus(result.compliance.status)}</h3>
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-semibold ${result.compliance.status === 'COMPLIANT' ? 'bg-success/10 text-success' : result.compliance.status === 'WARNING' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                  {result.compliance.status === 'COMPLIANT' ? 'Dentro do limite' : result.compliance.status === 'WARNING' ? 'Próximo do limite' : 'Limite violado'}
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="glass p-5">
                <p className="text-xs text-muted-foreground flex items-center gap-2"><Clock3 className="w-4 h-4 text-primary" /> Jornada</p>
                <p className="text-2xl font-semibold text-foreground mt-2">{formatHoursMinutes(currentDuty.totalDutyHours)}</p>
                <p className="text-xs text-muted-foreground mt-1">Começa na apresentação e termina após o pós-voo.</p>
              </div>
              <div className="glass p-5">
                <p className="text-xs text-muted-foreground flex items-center gap-2"><PlaneTakeoff className="w-4 h-4 text-primary" /> Tempo de voo</p>
                <p className="text-2xl font-semibold text-foreground mt-2">{formatHoursMinutes(currentDuty.totalFlightHours)}</p>
                <p className="text-xs text-muted-foreground mt-1">Trechos considerados: {result.dutyInput.legs.length}</p>
              </div>
              <div className="glass p-5">
                <p className="text-xs text-muted-foreground flex items-center gap-2"><Timer className="w-4 h-4 text-primary" /> Fim da jornada</p>
                <p className="text-2xl font-semibold text-foreground mt-2">{currentDuty.endTimeLocal.slice(11, 16)}</p>
                <p className="text-xs text-muted-foreground mt-1">Pouso final + {currentDuty.postFlightMinutes} min de pós-voo.</p>
              </div>
              <div className="glass p-5">
                <p className="text-xs text-muted-foreground flex items-center gap-2"><BedDouble className="w-4 h-4 text-primary" /> Início do descanso</p>
                <p className="text-2xl font-semibold text-foreground mt-2">{currentDuty.endTimeLocal.slice(11, 16)}</p>
                <p className="text-xs text-muted-foreground mt-1">O descanso começa somente após o término operacional.</p>
              </div>
              <div className="glass p-5">
                <p className="text-xs text-muted-foreground flex items-center gap-2"><MoonStar className="w-4 h-4 text-primary" /> WOCL / Madrugada</p>
                <p className="text-base font-semibold text-foreground mt-2">
                  {result.compliance.fatigue.woclExposure.totalMinutes > 0 ? `WOCL ${result.compliance.fatigue.woclExposure.totalMinutes} min` : 'Sem WOCL'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{currentDuty.isMadrugadaDuty ? 'A jornada toca a faixa 00:00–06:00.' : 'Sem operação em madrugada.'}</p>
              </div>
              <div className="glass p-5">
                <p className="text-xs text-muted-foreground flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Repouso até a próxima apresentação</p>
                <p className="text-2xl font-semibold text-foreground mt-2">{currentRest?.restBeforeDutyHours != null ? formatHoursMinutes(currentRest.restBeforeDutyHours) : '—'}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {currentRest ? `Mínimo exigido: ${formatHoursMinutes(currentRest.minRequiredRestHours)}${currentRest.augmentedRest ? ' (fora da base)' : ''}` : 'Informe a próxima apresentação para validar o descanso.'}
                </p>
              </div>
            </div>

            <div className="glass p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Alertas operacionais</h3>
              <div className="space-y-2">
                {result.compliance.alerts.length > 0 ? result.compliance.alerts.map((alert) => (
                  <div key={`${alert.ruleId}-${alert.message}`} className="rounded-xl bg-muted/60 px-3 py-2 text-sm">
                    <p className="font-medium text-foreground">{alert.message}</p>
                  </div>
                )) : (
                  <div className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Nenhum alerta relevante nesta simulação.
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
