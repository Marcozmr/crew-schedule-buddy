/**
 * Tempo discreto no Início (o MetCenter saiu da barra de baixo): agora na base e a previsão para o
 * próximo pouso, com link para a página completa de METAR/TAF.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAirportWeather } from '@/hooks/useAirportWeather';
import { useLegWeather } from '@/hooks/useLegWeather';

interface Props {
  base: string | null;
  nextArrival: { iata: string; date: string; time: string } | null;
}

export function WeatherStrip({ base, nextArrival }: Props) {
  const baseCodes = useMemo(() => (base ? [base] : []), [base]);
  const { data: now } = useAirportWeather(baseCodes);
  const queries = useMemo(() => (nextArrival ? [{ key: 'next', ...nextArrival }] : []), [nextArrival]);
  const legs = useLegWeather(queries);

  const baseNow = base ? now[base] : undefined;
  const arrival = legs.next?.forecast ?? null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-muted-foreground">
      {baseNow && baseNow.temp != null && (
        <span>
          {baseNow.conditionEmoji} Agora em {base} {Math.round(baseNow.temp)}°C
        </span>
      )}
      {arrival && nextArrival && (
        <span>
          {arrival.conditionEmoji} Pouso em {nextArrival.iata} {nextArrival.time} · {Math.round(arrival.temp)}°C
        </span>
      )}
      <Link to="/weather" className="ml-auto font-semibold text-primary hover:underline">
        METAR/TAF
      </Link>
    </div>
  );
}
