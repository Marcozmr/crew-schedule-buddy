import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Cloud, Search, Thermometer, Wind, Droplets, MapPin, FileText, Map, Satellite, Radio, ExternalLink, Info } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { AIRPORTS_DB } from '@/lib/airports';
import { FC_COLOR } from '@/hooks/useAirportWeather';

type Tab = 'briefing' | 'notam' | 'cartas' | 'sigwx';

interface WeatherData {
  temp: number; windSpeed: number; windDir: number; humidity: number; condition: string; conditionEmoji: string;
}

function getCondition(code: number): { label: string; emoji: string } {
  if (code < 0)  return { label: 'Desconhecido', emoji: '❓' };
  if (code === 0) return { label: 'Céu limpo', emoji: '☀️' };
  if (code === 1) return { label: 'Predominante limpo', emoji: '🌤️' };
  if (code === 2) return { label: 'Parcialmente nublado', emoji: '⛅' };
  if (code === 3) return { label: 'Nublado', emoji: '☁️' };
  if (code <= 48) return { label: 'Nevoeiro', emoji: '🌫️' };
  if (code <= 55) return { label: 'Garoa', emoji: '🌦️' };
  if (code <= 67) return { label: 'Chuva', emoji: '🌧️' };
  if (code <= 77) return { label: 'Neve', emoji: '❄️' };
  if (code <= 82) return { label: 'Chuvisco leve', emoji: '🌦️' };
  if (code <= 86) return { label: 'Neve forte', emoji: '❄️' };
  if (code <= 99) return { label: 'Tempestade', emoji: '⛈️' };
  return { label: 'Desconhecido', emoji: '❓' };
}

function parseFlightCategory(metar: string): string {
  if (!metar) return 'UNKN';
  let ceilingFt = 99999;
  for (const m of metar.matchAll(/\b(BKN|OVC|VV)(\d{3})\b/g)) {
    ceilingFt = Math.min(ceilingFt, parseInt(m[2]) * 100);
  }
  const visM = metar.match(/\b(\d{4})\b/);
  let visSM = 99;
  if (visM) visSM = parseInt(visM[1]) / 1609;
  if (ceilingFt < 500 || visSM < 1) return 'LIFR';
  if (ceilingFt < 1000 || visSM < 3) return 'IFR';
  if (ceilingFt < 3000 || visSM < 5) return 'MVFR';
  return 'VFR';
}

const QUICK_AIRPORTS = ['GRU', 'CGH', 'BSB', 'GIG', 'SSA', 'CNF', 'POA', 'REC', 'CWB', 'FOR', 'VIX', 'FLN'];

const NOTAM_RESOURCES = [
  { label: 'AISWEB — NOTAMs', desc: 'Base oficial DECEA para consulta de NOTAMs em vigor', icon: '📋', url: 'https://aisweb.decea.mil.br/?i=notam' },
  { label: 'REDEMET — Avisos', desc: 'Mensagens SIGMET, AIRMET e avisos meteorológicos', icon: '⚠️', url: 'https://www.redemet.aer.mil.br' },
  { label: 'AIS Brasil', desc: 'Publicações AIP, NOTAM e circulares do DECEA', icon: '📡', url: 'https://www.aisweb.decea.mil.br' },
];

const CHART_RESOURCES = [
  { label: 'Cartas IAC / SID / STAR', desc: 'Cartas de aproximação, saída e chegada do DECEA', icon: '🗺️', url: 'https://aisweb.decea.mil.br/?i=cartas&tipo=IAC' },
  { label: 'Carta VAC', desc: 'Visual Approach Chart — VFR e aeródromos', icon: '✈️', url: 'https://aisweb.decea.mil.br/?i=cartas&tipo=VAC' },
  { label: 'Carta ADC', desc: 'Aerodrome Chart — layout do aeródromo', icon: '🏙️', url: 'https://aisweb.decea.mil.br/?i=cartas&tipo=ADC' },
  { label: 'SID — Saída padrão', desc: 'Standard Instrument Departure routes', icon: '🛫', url: 'https://aisweb.decea.mil.br/?i=cartas&tipo=SID' },
  { label: 'STAR — Chegada padrão', desc: 'Standard Terminal Arrival Routes', icon: '🛬', url: 'https://aisweb.decea.mil.br/?i=cartas&tipo=STAR' },
];

const SIGWX_RESOURCES = [
  { label: 'SIGWX América do Sul', desc: 'Carta de Tempo Significativo — South America NAT', icon: '🌎', url: 'https://www.redemet.aer.mil.br/#conteudo' },
  { label: 'Satélite GOES (CPTEC)', desc: 'Imagens de satélite GOES-16 com animação', icon: '🛰️', url: 'https://satelite.cptec.inpe.br/home/index.jsp' },
  { label: 'Meteograma REDEMET', desc: 'Gráfico de previsão: vento, teto, temperatura, visibilidade', icon: '📊', url: 'https://www.redemet.aer.mil.br' },
  { label: 'Radar Meteorológico', desc: 'Radar do INMET — precipitação em tempo real', icon: '📡', url: 'https://www.inmet.gov.br/portal/index.php?r=radar/indexRadar' },
];

export default function WeatherPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('briefing');
  const [code, setCode] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [metar, setMetar] = useState('');
  const [taf, setTaf] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [sigmet, setSigmet] = useState('');

  useEffect(() => {
    if (!user) { setRecentSearches([]); return; }
    supabase.from('weather_recent_searches').select('airport_code').eq('user_id', user.id).order('searched_at', { ascending: false }).limit(8)
      .then(({ data }) => setRecentSearches([...new Set((data || []).map(d => d.airport_code))]));
  }, [user]);

  const search = async (iata?: string) => {
    const q = (iata || code).toUpperCase().trim();
    if (!q) return;
    const apt = AIRPORTS_DB[q];
    if (!apt) { toast.error(`Aeroporto ${q} não encontrado. Use código IATA (ex: GRU, BSB)`); return; }
    setLoading(true);
    setCode(q);
    setWeather(null); setMetar(''); setTaf(''); setSigmet('');
    try {
      const [wxRes, metarRes, tafRes, sigmetRes] = await Promise.allSettled([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${apt.lat}&longitude=${apt.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code&timezone=auto`).then(r => r.json()),
        fetch(`https://aviationweather.gov/api/data/metar?ids=${apt.icao}&format=raw`).then(r => r.text()),
        fetch(`https://aviationweather.gov/api/data/taf?ids=${apt.icao}&format=raw`).then(r => r.text()),
        fetch(`https://aviationweather.gov/api/data/sigmet?format=raw`).then(r => r.text()).catch(() => ''),
      ]);
      if (wxRes.status === 'fulfilled') {
        const c = wxRes.value.current;
        const cond = getCondition(c.weather_code);
        setWeather({ temp: c.temperature_2m, windSpeed: c.wind_speed_10m, windDir: c.wind_direction_10m, humidity: c.relative_humidity_2m, condition: cond.label, conditionEmoji: cond.emoji });
      }
      if (metarRes.status === 'fulfilled') setMetar(metarRes.value.trim());
      if (tafRes.status === 'fulfilled') setTaf(tafRes.value.trim());
      if (sigmetRes.status === 'fulfilled') setSigmet(sigmetRes.value.trim());
      if (user) {
        await supabase.from('weather_recent_searches').insert({ user_id: user.id, airport_code: q });
        setRecentSearches(prev => [q, ...prev.filter(p => p !== q)].slice(0, 8));
      }
    } catch { toast.error('Erro ao buscar dados'); } finally { setLoading(false); }
  };

  const fc = metar ? parseFlightCategory(metar) : null;
  const apt = AIRPORTS_DB[code];

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'briefing', label: 'Briefing', icon: Cloud },
    { id: 'notam', label: 'NOTAM', icon: FileText },
    { id: 'cartas', label: 'Cartas', icon: Map },
    { id: 'sigwx', label: 'Satélite', icon: Satellite },
  ];

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Cloud className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">MetCenter</h1>
            <p className="text-xs text-muted-foreground">Central de meteorologia e informações aeronáuticas</p>
          </div>
        </motion.div>

        {/* Tab navigation */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === t.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Briefing tab */}
        {activeTab === 'briefing' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Search */}
            <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Buscar aeródromo</p>
              <div className="flex gap-2">
                <Input
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="IATA ou ICAO (GRU, SBGR...)"
                  onKeyDown={e => e.key === 'Enter' && search()}
                  className="uppercase font-mono"
                  maxLength={4}
                />
                <Button onClick={() => search()} disabled={loading} size="icon">
                  <Search className="w-4 h-4" />
                </Button>
              </div>
              {/* Quick airports */}
              <div className="flex gap-1.5 flex-wrap">
                {QUICK_AIRPORTS.map(s => (
                  <button key={s} onClick={() => search(s)} className="px-2 py-1 text-[10px] font-mono font-medium rounded-lg bg-muted hover:bg-primary/10 hover:text-primary transition-colors">
                    {s}
                  </button>
                ))}
              </div>
              {recentSearches.length > 0 && (
                <div className="flex gap-1.5 flex-wrap border-t border-border pt-2">
                  <span className="text-[10px] text-muted-foreground self-center">Recentes:</span>
                  {recentSearches.map(s => (
                    <button key={s} onClick={() => search(s)} className="px-2 py-1 text-[10px] font-mono font-medium rounded-lg border border-border hover:border-primary hover:text-primary transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {loading && (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {weather && !loading && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                {/* Airport header */}
                <div className="bg-card rounded-2xl border border-border p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-bold text-foreground">{apt?.name || code}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {code} / {apt?.icao} — {apt?.city}
                      </p>
                    </div>
                    {fc && (
                      <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-bold ${FC_COLOR[fc as keyof typeof FC_COLOR] || FC_COLOR.UNKN}`}>
                        {fc}
                      </span>
                    )}
                  </div>
                  {/* Big weather widget */}
                  <div className="flex items-center gap-4 mb-3">
                    <span className="text-4xl">{weather.conditionEmoji}</span>
                    <div>
                      <p className="text-3xl font-bold text-foreground">{Math.round(weather.temp)}°C</p>
                      <p className="text-sm text-muted-foreground">{weather.condition}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-muted/50 rounded-xl p-2.5 text-center">
                      <Wind className="w-4 h-4 text-primary mx-auto mb-1" />
                      <p className="text-xs font-bold text-foreground">{Math.round(weather.windSpeed)} kt</p>
                      <p className="text-[10px] text-muted-foreground">Vento</p>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-2.5 text-center">
                      <Droplets className="w-4 h-4 text-primary mx-auto mb-1" />
                      <p className="text-xs font-bold text-foreground">{weather.humidity}%</p>
                      <p className="text-[10px] text-muted-foreground">Umidade</p>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-2.5 text-center">
                      <Thermometer className="w-4 h-4 text-primary mx-auto mb-1" />
                      <p className="text-xs font-bold text-foreground">{weather.windDir}°</p>
                      <p className="text-[10px] text-muted-foreground">Dir. vento</p>
                    </div>
                  </div>
                </div>

                {/* METAR */}
                {metar && (
                  <div className="bg-card rounded-2xl border border-border p-4">
                    <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Radio className="w-3.5 h-3.5 text-primary" /> METAR
                    </h3>
                    <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap bg-muted/60 p-3 rounded-xl leading-relaxed">
                      {metar}
                    </pre>
                  </div>
                )}

                {/* TAF */}
                {taf && (
                  <div className="bg-card rounded-2xl border border-border p-4">
                    <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Cloud className="w-3.5 h-3.5 text-primary" /> TAF
                    </h3>
                    <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap bg-muted/60 p-3 rounded-xl leading-relaxed">
                      {taf}
                    </pre>
                  </div>
                )}

                {/* SIGMET info */}
                {sigmet && (
                  <div className="bg-card rounded-2xl border border-warning/30 p-4">
                    <h3 className="text-xs font-semibold text-warning mb-2 flex items-center gap-2">
                      <Info className="w-3.5 h-3.5" /> SIGMET (global)
                    </h3>
                    <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap bg-muted/60 p-3 rounded-xl leading-relaxed max-h-40 overflow-y-auto">
                      {sigmet}
                    </pre>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* NOTAM tab */}
        {activeTab === 'notam' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">NOTAMs em vigor</h3>
                  <p className="text-xs text-muted-foreground">Avisos de aeródromo e espaço aéreo</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Consulte NOTAMs em vigor nos aeródromos brasileiros através das fontes oficiais do DECEA e REDEMET.
              </p>
            </div>
            {NOTAM_RESOURCES.map((r, i) => (
              <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                className="block bg-card rounded-2xl border border-border p-4 hover:border-primary/40 transition-colors group">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl shrink-0">{r.icon}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">{r.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.desc}</p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                </div>
              </a>
            ))}
          </motion.div>
        )}

        {/* Cartas tab */}
        {activeTab === 'cartas' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Map className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Cartas Aeronáuticas</h3>
                  <p className="text-xs text-muted-foreground">SID, STAR, IAC, ADC, VAC — DECEA oficial</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                Cartas publicadas pelo DECEA no AISWEB. Abre no navegador do sistema.
              </p>
            </div>
            {CHART_RESOURCES.map((r, i) => (
              <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                className="block bg-card rounded-2xl border border-border p-4 hover:border-primary/40 transition-colors group">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl shrink-0">{r.icon}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">{r.label}</p>
                      <p className="text-xs text-muted-foreground">{r.desc}</p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                </div>
              </a>
            ))}
          </motion.div>
        )}

        {/* Satélite / SIGWX tab */}
        {activeTab === 'sigwx' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Satellite className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Satélite & SIGWX</h3>
                  <p className="text-xs text-muted-foreground">Imagens, radar e carta de tempo significativo</p>
                </div>
              </div>
            </div>
            {SIGWX_RESOURCES.map((r, i) => (
              <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                className="block bg-card rounded-2xl border border-border p-4 hover:border-primary/40 transition-colors group">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl shrink-0">{r.icon}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">{r.label}</p>
                      <p className="text-xs text-muted-foreground">{r.desc}</p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                </div>
              </a>
            ))}
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
