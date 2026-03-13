import { useMemo, useEffect, useRef } from 'react';
import { airportCoordinates } from '@/lib/airport-data';
import { MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface RouteHeatMapProps {
  departures: string[];
  arrivals: string[];
}

export function RouteHeatMap({ departures, arrivals }: RouteHeatMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const heatData = useMemo(() => {
    const counts: Record<string, number> = {};
    [...departures, ...arrivals].forEach(code => {
      const upper = code?.trim().toUpperCase();
      if (upper) counts[upper] = (counts[upper] || 0) + 1;
    });

    return Object.entries(counts)
      .filter(([code]) => airportCoordinates[code])
      .map(([code, count]) => ({
        code,
        count,
        ...airportCoordinates[code],
      }))
      .sort((a, b) => b.count - a.count);
  }, [departures, arrivals]);

  const maxCount = Math.max(...heatData.map(d => d.count), 1);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [-10, -50],
      zoom: 3,
      minZoom: 2,
      maxZoom: 10,
      scrollWheelZoom: true,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers when data changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing markers
    map.eachLayer(layer => {
      if (layer instanceof L.CircleMarker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    // Draw route lines between departures and arrivals
    const pairs: [string, string][] = [];
    const minLen = Math.min(departures.length, arrivals.length);
    for (let i = 0; i < minLen; i++) {
      const dep = departures[i]?.trim().toUpperCase();
      const arr = arrivals[i]?.trim().toUpperCase();
      if (dep && arr && airportCoordinates[dep] && airportCoordinates[arr]) {
        pairs.push([dep, arr]);
      }
    }

    // Draw route lines
    const drawnRoutes = new Set<string>();
    pairs.forEach(([dep, arr]) => {
      const routeKey = [dep, arr].sort().join('-');
      if (drawnRoutes.has(routeKey)) return;
      drawnRoutes.add(routeKey);

      const depCoord = airportCoordinates[dep];
      const arrCoord = airportCoordinates[arr];

      L.polyline(
        [[depCoord.lat, depCoord.lng], [arrCoord.lat, arrCoord.lng]],
        {
          color: 'hsl(217, 91%, 50%)',
          weight: 1.5,
          opacity: 0.3,
          dashArray: '4 6',
        }
      ).addTo(map);
    });

    // Add airport markers
    heatData.forEach(point => {
      const intensity = point.count / maxCount;
      const radius = 6 + intensity * 18;
      const color = intensity > 0.7
        ? 'hsl(0, 72%, 51%)'
        : intensity > 0.4
        ? 'hsl(38, 92%, 50%)'
        : 'hsl(217, 91%, 50%)';

      // Glow circle
      L.circleMarker([point.lat, point.lng], {
        radius: radius * 1.8,
        fillColor: color,
        fillOpacity: 0.15,
        stroke: false,
      }).addTo(map);

      // Main dot
      const marker = L.circleMarker([point.lat, point.lng], {
        radius,
        fillColor: color,
        fillOpacity: 0.9,
        color: 'white',
        weight: 2,
        opacity: 0.6,
      }).addTo(map);

      marker.bindPopup(
        `<div style="text-align:center;font-family:sans-serif;">
          <strong style="font-size:14px;">${point.code}</strong><br/>
          <span style="color:#666;">${point.name}</span><br/>
          <strong style="color:${color};">${point.count}x</strong> operações
        </div>`,
        { className: 'custom-popup' }
      );

      marker.bindTooltip(
        `${point.code} — ${point.count}x`,
        { permanent: false, direction: 'top', offset: [0, -radius] }
      );
    });

    // Fit bounds if we have data
    if (heatData.length > 0) {
      const bounds = L.latLngBounds(heatData.map(p => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds.pad(0.3));
    }
  }, [heatData, maxCount, departures, arrivals]);

  if (heatData.length === 0) {
    return (
      <div className="bg-card rounded-xl p-8 shadow-card text-center">
        <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">Importe sua escala para ver o mapa de destinos no mapa mundi</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
      <div className="px-6 pt-6 pb-3 flex items-center justify-between">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          Mapa de Destinos
        </h2>
        <span className="text-xs text-muted-foreground">{heatData.length} aeroporto(s)</span>
      </div>

      {/* Leaflet Map */}
      <div ref={mapRef} className="w-full h-[400px] md:h-[500px]" />

      {/* Legend + top destinations */}
      <div className="px-6 py-4 border-t border-border">
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: 'hsl(217, 91%, 50%)' }} />
            Pouco frequente
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: 'hsl(38, 92%, 50%)' }} />
            Moderado
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: 'hsl(0, 72%, 51%)' }} />
            Frequente
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {heatData.slice(0, 10).map(point => (
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
