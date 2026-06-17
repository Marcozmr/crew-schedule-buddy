import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, BedDouble, CheckCircle2, Clock3, Timer } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumericInput } from '@/components/ui/numeric-input';
import { calculateDuty, calculateRest, type DutyPeriodInput, type ScheduleWindow } from '@/regulation';
import { useOperationalPreferences } from '@/hooks/useOperationalPreferences';
import { formatHoursMinutes } from '@/lib/date-utils';
import { mapAircraftCategory, mapCrewRole, toUtcIso } from '@/lib/operational-analysis';

export default function RestCalcPage() {
  const { timezone, homeBase } = useOperationalPreferences();
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [lastLanding, setLastLanding] = useState('06:45');
  const [postFlightMinutes, setPostFlightMinutes] = useState<number | null>(30);
  const [nextReport, setNextReport] = useState('');
  const [baseAirport, setBaseAirport] = useState((homeBase || 'GRU').toUpperCase());
  const [arrivalAirport, setArrivalAirport] = useState((homeBase || 'GRU').toUpperCase());
  const [crewRole, setCrewRole] = useState<'Comandante' | 'Copiloto' | 'Comissário'>('Comissário');
  const [result, setResult] = useState<ReturnType<typeof calculateRest> | null>(null);
  const [endOfDuty, setEndOfDuty] = useState<string>('');
  const [error, setError] = useState('');

  const handleCalculate = () => {
    setError('');
    if (!endDate || !lastLanding || !nextReport) {
      setError('Informe pouso final, data e próxima apresentação.');
      return;
    }

    const currentDutyInput: DutyPeriodInput = {
      reportTimeUtc: toUtcIso(endDate, '00:00', timezone),
      legs: [
        {
          id: 'rest-manual-leg',
          flightNumber: 'REST001',
          departureAirport: baseAirport,
          arrivalAirport,
          scheduledDepartureUtc: toUtcIso(endDate, lastLanding, timezone),
          scheduledArrivalUtc: toUtcIso(endDate, lastLanding, timezone),
          aircraftCategory: mapAircraftCategory('A320'),
          activityType: 'flight',
        },
      ],
      baseAirport: baseAirport,
      crewRole: mapCrewRole(crewRole),
      aircraftCategory: mapAircraftCategory('A320'),
      postFlightMinutes: postFlightMinutes ?? 30,
    };

    const nextDutyInput: DutyPeriodInput = {
      reportTimeUtc: new Date(nextReport).toISOString(),
      legs: [],
      baseAirport: baseAirport,
      crewRole: mapCrewRole(crewRole),
      aircraftCategory: mapAircraftCategory('A320'),
      postFlightMinutes: 30,
    };

    const crew: ScheduleWindow['crew'] = {
      crewId: 'rest-check',
      crewRole: currentDutyInput.crewRole,
      baseAirport,
      aircraftCategory: currentDutyInput.aircraftCategory,
      airline: 'LATAM',
      timezone,
    };

    const currentDuty = calculateDuty(currentDutyInput, timezone);
    const nextDuty = calculateDuty(nextDutyInput, timezone);
    const rest = calculateRest(1, [currentDuty, nextDuty], {
      dutyPeriods: [currentDutyInput, nextDutyInput],
      referenceDate: nextDutyInput.reportTimeUtc,
      crew,
    });

    setEndOfDuty(currentDuty.endTimeLocal);
    setResult(rest);
  };

  return (
    <AppLayout>
      <div className="space-y-6 pb-10 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
          <h1 className="text-xl font-bold text-foreground">Calcular descanso</h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            O descanso começa após o pós-voo: pouso final + tempo debrief configurado.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-6">
          <section className="glass p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Data do pouso final</Label>
              <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Pouso final</Label>
              <Input type="time" value={lastLanding} onChange={(event) => setLastLanding(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Pós-voo (min)</Label>
              <NumericInput value={postFlightMinutes} onValueChange={setPostFlightMinutes} min={0} max={120} decimals={0} blurDefault={30} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Próxima apresentação</Label>
              <Input type="datetime-local" value={nextReport} onChange={(event) => setNextReport(event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Minha base</Label>
                <Input value={baseAirport} onChange={(event) => setBaseAirport(event.target.value.toUpperCase())} maxLength={4} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Chegada final</Label>
                <Input value={arrivalAirport} onChange={(event) => setArrivalAirport(event.target.value.toUpperCase())} maxLength={4} />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button onClick={handleCalculate} className="w-full">
              <Clock3 className="w-4 h-4 mr-2" />
              Calcular descanso
            </Button>
          </section>

          <section className="space-y-4">
            {result ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="glass p-5">
                  <p className="text-xs text-muted-foreground">Fim da jornada operacional</p>
                  <p className="text-2xl font-semibold text-foreground mt-2">{endOfDuty.slice(0, 16).replace('T', ' ')}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    <Timer className="w-4 h-4 text-primary" />
                    O repouso só começa após {postFlightMinutes ?? 30} min de pós-voo.
                  </p>
                </div>

                <div className={`glass p-5 ${result.restBeforeDutyHours != null && result.restBeforeDutyHours >= result.minRequiredRestHours ? '' : 'border border-destructive/30'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Descanso calculado</p>
                      <p className="text-3xl font-semibold text-foreground mt-2">{result.restBeforeDutyHours != null ? formatHoursMinutes(result.restBeforeDutyHours) : '—'}</p>
                      <p className="text-sm text-muted-foreground mt-1">Mínimo exigido: {formatHoursMinutes(result.minRequiredRestHours)}</p>
                    </div>
                    {result.restBeforeDutyHours != null && result.restBeforeDutyHours >= result.minRequiredRestHours ? (
                      <div className="rounded-full bg-success/10 p-2 text-success"><CheckCircle2 className="w-5 h-5" /></div>
                    ) : (
                      <div className="rounded-full bg-destructive/10 p-2 text-destructive"><AlertTriangle className="w-5 h-5" /></div>
                    )}
                  </div>
                  <p className={`text-sm mt-3 ${result.restBeforeDutyHours != null && result.restBeforeDutyHours >= result.minRequiredRestHours ? 'text-success' : 'text-destructive'}`}>
                    {result.restBeforeDutyHours != null && result.restBeforeDutyHours >= result.minRequiredRestHours
                      ? 'Repouso suficiente para a próxima jornada.'
                      : 'Repouso insuficiente para a próxima jornada.'}
                  </p>
                </div>
              </motion.div>
            ) : (
              <div className="glass p-8 min-h-[280px] flex items-center justify-center text-center">
                <p className="text-sm text-muted-foreground">Informe o pouso final, o pós-voo e a próxima apresentação.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
