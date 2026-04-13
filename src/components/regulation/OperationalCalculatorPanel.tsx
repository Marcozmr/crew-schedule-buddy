import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, BedDouble, Clock3, PlaneTakeoff, ShieldAlert, ShieldCheck, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumericInput } from '@/components/ui/numeric-input';
import { checkSingleDuty, type DutyPeriodInput, type ScheduleWindow } from '@/regulation';
import { formatHoursMinutes } from '@/lib/date-utils';
import { mapAircraftCategory, mapCrewRole, timeToMinutes, toUtcIso } from '@/lib/operational-analysis';

interface OperationalCalculatorPanelProps {
  timezone: string;
  homeBase?: string | null;
}

interface ScenarioResult {
  dutyInput: DutyPeriodInput;
  compliance: ReturnType<typeof checkSingleDuty>;
}

/** Bloco de voo sintético para o motor de regulamento (campos removidos do formulário). */
const DEFAULT_POST_FLIGHT_MIN = 30;
const DEFAULT_REPORT_TO_TAKEOFF_MIN = 35;
const DEFAULT_AIRCRAFT = 'A320';
const INTERNAL_CREW_ROLE = 'Comissário' as const;

function minutesToHHMM(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const min = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Deriva decolagem / pouso a partir da apresentação e do número de trechos (simulação interna). */
function deriveSyntheticLegTimes(
  reportTime: string,
  stages: number,
): { takeoffTime: string; landingTime: string; takeoffDayOffset: number; landingDayOffset: number } {
  const rep = timeToMinutes(reportTime);
  const takeoffAbs = rep + DEFAULT_REPORT_TO_TAKEOFF_MIN;
  const blockMin = Math.max(60, stages * 45);
  const landingAbs = takeoffAbs + blockMin;
  const takeoffDayOffset = Math.floor(takeoffAbs / (24 * 60));
  const landingDayOffset = Math.floor(landingAbs / (24 * 60));
  return {
    takeoffTime: minutesToHHMM(takeoffAbs % (24 * 60)),
    landingTime: minutesToHHMM(landingAbs % (24 * 60)),
    takeoffDayOffset,
    landingDayOffset,
  };
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
  const [stages, setStages] = useState<number | null>(2);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ScenarioResult | null>(null);

  const handleCalculate = () => {
    setError('');
    const nStages = stages ?? 1;
    if (!operationDate || !reportTime || nStages < 1) {
      setError('Preencha data, apresentação e trechos (mínimo 1).');
      return;
    }

    const { takeoffTime, landingTime, takeoffDayOffset, landingDayOffset } = deriveSyntheticLegTimes(
      reportTime,
      nStages,
    );
    const base = (homeBase || 'GRU').toUpperCase().slice(0, 4);
    const departureAirport = base;
    const arrivalAirport = base === 'GRU' ? 'BSB' : 'GRU';

    const dutyInput: DutyPeriodInput = {
      reportTimeUtc: toUtcIso(operationDate, reportTime, timezone),
      legs: [
        {
          id: 'manual-leg-1',
          flightNumber: 'SIM001',
          departureAirport,
          arrivalAirport,
          scheduledDepartureUtc: toUtcIso(operationDate, takeoffTime, timezone, takeoffDayOffset),
          scheduledArrivalUtc: toUtcIso(operationDate, landingTime, timezone, landingDayOffset),
          aircraftCategory: mapAircraftCategory(DEFAULT_AIRCRAFT),
          activityType: 'flight',
          crossesMidnight: landingDayOffset > takeoffDayOffset,
        },
      ],
      baseAirport: base,
      crewRole: mapCrewRole(INTERNAL_CREW_ROLE),
      aircraftCategory: mapAircraftCategory(DEFAULT_AIRCRAFT),
      postFlightMinutes: DEFAULT_POST_FLIGHT_MIN,
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

    setResult({ dutyInput, compliance });
  };

  const currentDuty = result?.compliance.duty;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] gap-6">
      <section className="glass p-5 lg:p-6 space-y-5 min-w-0">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground break-words">Cálculo operacional avançado</h2>
          <p className="text-sm text-muted-foreground mt-1 break-words">
            Simule a jornada com base nesses três dados; o restante é assumido internamente para esta estimativa —
            não reproduz todos os detalhes de uma operação real.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          <div className="glass p-6 sm:p-8 min-h-[240px] flex items-center justify-center text-center">
            <div className="min-w-0">
              <ShieldAlert className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground break-words">
                Preencha data, trechos e apresentação e toque em Calcular jornada.
              </p>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <p className="text-xs text-muted-foreground mt-1 break-words">Após término operacional (inclui corte de motores e pós-voo padrão).</p>
              </div>
              <div className="glass p-5 min-w-0">
                <p className="text-xs text-muted-foreground flex items-center gap-2"><BedDouble className="w-4 h-4 text-primary shrink-0" /> Início do descanso</p>
                <p className="text-xl sm:text-2xl font-semibold text-foreground mt-2 whitespace-nowrap">{currentDuty.endTimeLocal.slice(11, 16)}</p>
                <p className="text-xs text-muted-foreground mt-1 break-words">O descanso começa somente após o término operacional.</p>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
