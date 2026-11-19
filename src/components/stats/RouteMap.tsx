/**
 * Mapa de rotas offline: contorno dos países (Natural Earth 110m, via world-atlas) e linhas retas
 * entre aeroportos. Não é a trajetória real do voo.
 */
import { useMemo, useRef, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { FeatureCollection } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
import { getAirport } from '@/lib/airports';

const W = 340;
const H = 300;
const PAD_DEG = 2;

/** Países do mundo menos a Antártida (fora de qualquer rota e pesada no Mercator). */
const allCountries = feature(
  world as unknown as Topology,
  (world as unknown as Topology).objects.countries as GeometryCollection,
) as unknown as FeatureCollection;
const countries: FeatureCollection = {
  ...allCountries,
  features: allCountries.features.filter((c) => String(c.id) !== '010'),
};

export function RouteMap({ legs }: { legs: Array<{ from: string; to: string }> }) {
  const [zoom, setZoom] = useState(1);
  // Arrastar move o mapa (em unidades do quadro), para ver aeroportos fora do centro.
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const points = useMemo(() => {
    const codes = [...new Set(legs.flatMap((l) => [l.from, l.to]))];
    return codes
      .map((iata) => ({ iata, apt: getAirport(iata) }))
      .filter((p): p is { iata: string; apt: NonNullable<ReturnType<typeof getAirport>> } => Boolean(p.apt));
  }, [legs]);

  const projection = useMemo(() => {
    const p = geoMercator();
    // Recorta a geometria no quadro: sem isso, o resto do mundo vira coordenadas enormes fora da
    // área visível e redesenhar o SVG trava a WebView (CPU em 100%).
    p.clipExtent([[0, 0], [W, H]]);
    if (points.length === 0) return p.fitExtent([[0, 0], [W, H]], { type: 'MultiPoint', coordinates: [[-75, -35], [-34, 6]] });
    const lons = points.map((x) => x.apt.lon);
    const lats = points.map((x) => x.apt.lat);
    return p.fitExtent([[28, 28], [W - 28, H - 28]], {
      type: 'MultiPoint',
      coordinates: [
        [Math.min(...lons) - PAD_DEG, Math.min(...lats) - PAD_DEG],
        [Math.max(...lons) + PAD_DEG, Math.max(...lats) + PAD_DEG],
      ],
    });
  }, [points]);

  const path = useMemo(() => geoPath(projection), [projection]);
  const xy = (iata: string) => {
    const a = getAirport(iata);
    return a ? projection([a.lon, a.lat]) : null;
  };

  return (
    <div className="relative overflow-hidden rounded-xl bg-muted/40">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Mapa de rotas"
        className="block h-auto w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const width = e.currentTarget.getBoundingClientRect().width;
          const k = width > 0 ? W / width : 1;
          setPan({ x: d.px + (e.clientX - d.x) * k, y: d.py + (e.clientY - d.y) * k });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <g transform={`translate(${pan.x} ${pan.y}) translate(${W / 2} ${H / 2}) scale(${zoom}) translate(${-W / 2} ${-H / 2})`}>
          <path d={path(countries) ?? ''} className="fill-muted stroke-border" strokeWidth={0.6 / zoom} />
          {legs.map((l) => {
            const a = xy(l.from);
            const b = xy(l.to);
            if (!a || !b) return null;
            return <line key={`${l.from}-${l.to}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="stroke-primary/50" strokeWidth={1.4 / zoom} />;
          })}
          {points.map(({ iata }) => {
            const p = xy(iata);
            if (!p) return null;
            return (
              <g key={iata}>
                <circle cx={p[0]} cy={p[1]} r={3.2 / zoom} className="fill-accent stroke-background" strokeWidth={1 / zoom} />
                <text x={p[0] + 5 / zoom} y={p[1] - 4 / zoom} fontSize={9 / zoom} className="fill-foreground font-semibold">
                  {iata}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="absolute right-2 top-2 flex gap-1.5">
        <button type="button" aria-label="Diminuir" onClick={() => setZoom((z) => Math.max(1, z / 1.5))} className="h-8 w-8 rounded-lg border border-border bg-card text-sm font-semibold shadow-sm">
          −
        </button>
        <button type="button" aria-label="Aumentar" onClick={() => setZoom((z) => Math.min(8, z * 1.5))} className="h-8 w-8 rounded-lg border border-border bg-card text-sm font-semibold shadow-sm">
          +
        </button>
        <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="h-8 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold shadow-sm">
          Enquadrar
        </button>
      </div>
    </div>
  );
}
