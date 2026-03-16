import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Cloud, Search, Thermometer, Wind, Eye, Droplets } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

// IATA to coordinates mapping (common Brazilian airports)
const AIRPORTS: Record<string, { lat: number; lon: number; name: string; icao: string }> = {
  GRU: { lat: -23.4356, lon: -46.4731, name: 'Guarulhos', icao: 'SBGR' },
  CGH: { lat: -23.6261, lon: -46.6564, name: 'Congonhas', icao: 'SBSP' },
  BSB: { lat: -15.8711, lon: -47.9186, name: 'Brasília', icao: 'SBBR' },
  GIG: { lat: -22.8099, lon: -43.2505, name: 'Galeão', icao: 'SBGL' },
  SDU: { lat: -22.9105, lon: -43.1631, name: 'Santos Dumont', icao: 'SBRJ' },
  SSA: { lat: -12.9086, lon: -38.3225, name: 'Salvador', icao: 'SBSV' },
  CNF: { lat: -19.6244, lon: -43.9719, name: 'Confins', icao: 'SBCF' },
  POA: { lat: -29.9944, lon: -51.1711, name: 'Porto Alegre', icao: 'SBPA' },
  REC: { lat: -8.1264, lon: -34.9236, name: 'Recife', icao: 'SBRF' },
  CWB: { lat: -25.5285, lon: -49.1758, name: 'Curitiba', icao: 'SBCT' },
  FOR: { lat: -3.7761, lon: -38.5325, name: 'Fortaleza', icao: 'SBFZ' },
  VCP: { lat: -23.0074, lon: -47.1345, name: 'Campinas', icao: 'SBKP' },
  MAO: { lat: -3.0386, lon: -60.0497, name: 'Manaus', icao: 'SBEG' },
  BEL: { lat: -1.3792, lon: -48.4764, name: 'Belém', icao: 'SBBE' },
  FLN: { lat: -27.6703, lon: -48.5525, name: 'Florianópolis', icao: 'SBFL' },
  NAT: { lat: -5.9111, lon: -35.2478, name: 'Natal', icao: 'SBNT' },
  MCZ: { lat: -9.5108, lon: -35.7917, name: 'Maceió', icao: 'SBMO' },
  VIX: { lat: -20.2581, lon: -40.2864, name: 'Vitória', icao: 'SBVT' },
  CGB: { lat: -15.6528, lon: -56.1167, name: 'Cuiabá', icao: 'SBCY' },
  GYN: { lat: -16.6319, lon: -49.2206, name: 'Goiânia', icao: 'SBGO' },
};

interface WeatherData {
  temp: number;
  windSpeed: number;
  windDir: number;
  humidity: number;
  condition: string;
  visibility?: number;
}

export default function WeatherPage() {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [metar, setMetar] = useState('');
  const [taf, setTaf] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from('weather_recent_searches').select('airport_code').eq('user_id', user.id).order('searched_at', { ascending: false }).limit(5)
      .then(({ data }) => setRecentSearches([...new Set((data || []).map(d => d.airport_code))]));
  }, [user]);

  const search = async (iata?: string) => {
    const q = (iata || code).toUpperCase().trim();
    if (!q) return;
    const apt = AIRPORTS[q];
    if (!apt) { toast.error(`Aeroporto ${q} não encontrado`); return; }

    setLoading(true);
    setCode(q);

    try {
      // Open-Meteo
      const wxRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${apt.lat}&longitude=${apt.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code&timezone=America/Sao_Paulo`);
      const wxData = await wxRes.json();
      const c = wxData.current;
      setWeather({
        temp: c.temperature_2m,
        windSpeed: c.wind_speed_10m,
        windDir: c.wind_direction_10m,
        humidity: c.relative_humidity_2m,
        condition: getCondition(c.weather_code),
      });

      // METAR/TAF from AviationWeather
      try {
        const metarRes = await fetch(`https://aviationweather.gov/api/data/metar?ids=${apt.icao}&format=raw`);
        setMetar(await metarRes.text());
      } catch { setMetar('Indisponível'); }

      try {
        const tafRes = await fetch(`https://aviationweather.gov/api/data/taf?ids=${apt.icao}&format=raw`);
        setTaf(await tafRes.text());
      } catch { setTaf('Indisponível'); }

      // Save search
      if (user) {
        await supabase.from('weather_recent_searches').insert({ user_id: user.id, airport_code: q });
        setRecentSearches(prev => [q, ...prev.filter(p => p !== q)].slice(0, 5));
      }
    } catch (e: any) {
      toast.error('Erro ao buscar clima');
    } finally {
      setLoading(false);
    }
  };

  const getCondition = (code: number): string => {
    if (code <= 3) return ['Céu limpo', 'Parcialmente nublado', 'Nublado', 'Encoberto'][code] || 'Céu limpo';
    if (code <= 49) return 'Nevoeiro';
    if (code <= 69) return 'Chuva';
    if (code <= 79) return 'Neve';
    if (code <= 99) return 'Tempestade';
    return 'Desconhecido';
  };

  return (
    <AppLayout>
      <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
        <Cloud className="w-6 h-6 text-primary" />Clima
      </motion.h1>

      <div className="bg-card rounded-xl p-6 shadow-card mb-6 border border-border max-w-lg">
        <div className="flex gap-2 mb-3">
          <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Código IATA (BSB, GRU...)" onKeyDown={e => e.key === 'Enter' && search()} className="uppercase" />
          <Button onClick={() => search()} disabled={loading}><Search className="w-4 h-4" /></Button>
        </div>
        {recentSearches.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {recentSearches.map(s => (
              <Button key={s} size="sm" variant="outline" onClick={() => search(s)} className="text-xs">{s}</Button>
            ))}
          </div>
        )}
      </div>

      {loading && <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}

      {weather && !loading && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 max-w-lg">
          <div className="bg-card rounded-xl p-6 shadow-card">
            <h3 className="font-semibold text-foreground mb-1">{AIRPORTS[code]?.name || code}</h3>
            <p className="text-sm text-muted-foreground mb-4">{code} / {AIRPORTS[code]?.icao}</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2"><Thermometer className="w-5 h-5 text-primary" /><div><p className="text-xs text-muted-foreground">Temperatura</p><p className="text-xl font-bold text-foreground">{weather.temp}°C</p></div></div>
              <div className="flex items-center gap-2"><Wind className="w-5 h-5 text-primary" /><div><p className="text-xs text-muted-foreground">Vento</p><p className="text-xl font-bold text-foreground">{weather.windSpeed} km/h</p></div></div>
              <div className="flex items-center gap-2"><Droplets className="w-5 h-5 text-primary" /><div><p className="text-xs text-muted-foreground">Umidade</p><p className="text-xl font-bold text-foreground">{weather.humidity}%</p></div></div>
              <div className="flex items-center gap-2"><Cloud className="w-5 h-5 text-primary" /><div><p className="text-xs text-muted-foreground">Condição</p><p className="text-xl font-bold text-foreground">{weather.condition}</p></div></div>
            </div>
          </div>

          {metar && (
            <div className="bg-card rounded-xl p-6 shadow-card">
              <h3 className="font-semibold text-foreground mb-2">METAR</h3>
              <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap bg-muted p-3 rounded-lg">{metar || 'Indisponível'}</pre>
            </div>
          )}

          {taf && (
            <div className="bg-card rounded-xl p-6 shadow-card">
              <h3 className="font-semibold text-foreground mb-2">TAF</h3>
              <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap bg-muted p-3 rounded-lg">{taf || 'Indisponível'}</pre>
            </div>
          )}
        </motion.div>
      )}
    </AppLayout>
  );
}
