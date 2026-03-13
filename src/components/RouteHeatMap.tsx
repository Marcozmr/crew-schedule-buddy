import { useMemo } from 'react';
import { airportCoordinates } from '@/lib/airport-data';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';

interface HeatMapProps {
  departures: string[];
  arrivals: string[];
}

export function RouteHeatMap({ departures, arrivals }: HeatMapProps) {
  const heatData = useMemo(() => {
    const counts: Record<string, number> = {};

    [...departures, ...arrivals].forEach(code => {
      const upper = code?.trim().toUpperCase();
      if (upper) counts[upper] = (counts[upper] || 0) + 1;
    });

    const entries = Object.entries(counts)
      .filter(([code]) => airportCoordinates[code])
      .map(([code, count]) => ({
        code,
        count,
        ...airportCoordinates[code],
      }))
      .sort((a, b) => b.count - a.count);

    return entries;
  }, [departures, arrivals]);

  const maxCount = Math.max(...heatData.map(d => d.count), 1);

  if (heatData.length === 0) {
    return (
      <div className="bg-card rounded-xl p-8 shadow-card text-center">
        <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">Importe sua escala para ver o mapa de calor dos destinos</p>
      </div>
    );
  }

  // Map boundaries for Brazil + common international
  const mapBounds = {
    minLat: -35,
    maxLat: 55,
    minLng: -85,
    maxLng: 60,
  };

  const mapWidth = 100;
  const mapHeight = 100;

  const toX = (lng: number) => ((lng - mapBounds.minLng) / (mapBounds.maxLng - mapBounds.minLng)) * mapWidth;
  const toY = (lat: number) => ((mapBounds.maxLat - lat) / (mapBounds.maxLat - mapBounds.minLat)) * mapHeight;

  return (
    <div className="bg-card rounded-xl p-6 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          Mapa de Calor — Destinos
        </h2>
        <span className="text-xs text-muted-foreground">{heatData.length} aeroporto(s)</span>
      </div>

      {/* Map visualization */}
      <div className="relative w-full aspect-[16/9] bg-muted/30 rounded-lg overflow-hidden border border-border">
        {/* Grid lines */}
        <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 100 100" preserveAspectRatio="none">
          {[20, 40, 60, 80].map(v => (
            <g key={v}>
              <line x1={v} y1="0" x2={v} y2="100" stroke="currentColor" strokeWidth="0.3" className="text-foreground" />
              <line x1="0" y1={v} x2="100" y2={v} stroke="currentColor" strokeWidth="0.3" className="text-foreground" />
            </g>
          ))}
        </svg>

        {/* Heat dots */}
        {heatData.map((point, i) => {
          const x = toX(point.lng);
          const y = toY(point.lat);
          const intensity = point.count / maxCount;
          const size = 8 + intensity * 24;
          const glowSize = size * 2.5;

          return (
            <motion.div
              key={point.code}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05, type: 'spring' }}
              className="absolute group"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {/* Glow */}
              <div
                className="absolute rounded-full"
                style={{
                  width: `${glowSize}px`,
                  height: `${glowSize}px`,
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: `radial-gradient(circle, ${
                    intensity > 0.7
                      ? 'hsl(0 72% 51% / 0.3)'
                      : intensity > 0.4
                      ? 'hsl(38 92% 50% / 0.3)'
                      : 'hsl(217 91% 50% / 0.25)'
                  }, transparent)`,
                }}
              />
              {/* Dot */}
              <div
                className="rounded-full border-2 border-white/30 relative"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  background: intensity > 0.7
                    ? 'hsl(0 72% 51%)'
                    : intensity > 0.4
                    ? 'hsl(38 92% 50%)'
                    : 'hsl(217 91% 50%)',
                }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-foreground text-background text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {point.code} — {point.name} ({point.count}x)
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ background: 'hsl(217 91% 50%)' }} />
          Pouco frequente
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ background: 'hsl(38 92% 50%)' }} />
          Moderado
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ background: 'hsl(0 72% 51%)' }} />
          Frequente
        </div>
      </div>

      {/* Top destinations list */}
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs font-medium text-muted-foreground mb-2">Destinos mais frequentes</p>
        <div className="flex flex-wrap gap-2">
          {heatData.slice(0, 8).map(point => (
            <span
              key={point.code}
              className="text-xs font-mono px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium"
            >
              {point.code} <span className="text-muted-foreground">({point.count}x)</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
