import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { FlightCard } from '@/components/FlightCard';
import { searchFlights, searchByRoute } from '@/lib/aviation-api';
import { FlightInfo } from '@/lib/types';
import { Search, Plane, Loader2, ArrowRightLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

type SearchType = 'flight' | 'departure' | 'arrival' | 'route' | 'airline';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [query2, setQuery2] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('flight');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [results, setResults] = useState<FlightInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);

    try {
      let data: FlightInfo[] = [];
      const q = query.trim().toUpperCase();

      if (searchType === 'route' && q && query2.trim()) {
        data = await searchByRoute(q, query2.trim().toUpperCase());
      } else {
        const params: Record<string, string> = {};

        if (q) {
          switch (searchType) {
            case 'flight': params.flight_iata = q; break;
            case 'departure': params.dep_iata = q; break;
            case 'arrival': params.arr_iata = q; break;
            case 'airline': params.airline_iata = q; break;
          }
        }

        if (statusFilter && statusFilter !== 'all') {
          params.flight_status = statusFilter;
        }

        data = await searchFlights(params);
      }

      setResults(data);
      if (data.length === 0) {
        toast.info('Nenhum voo encontrado');
      } else {
        toast.success(`${data.length} voo(s) encontrado(s)`);
      }
    } catch {
      toast.error('Erro ao buscar voos');
    }

    setLoading(false);
  };

  const placeholders: Record<SearchType, string> = {
    flight: 'Ex: JJ3401, G31234, AD4001',
    departure: 'Ex: GRU, GIG, BSB',
    arrival: 'Ex: GRU, GIG, BSB',
    route: 'Origem (ex: GRU)',
    airline: 'Ex: JJ, G3, AD',
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-2">Buscar Voos em Tempo Real</h1>
        <p className="text-muted-foreground mb-8">
          Pesquise voos por número, aeroporto, rota ou companhia aérea com dados ao vivo.
        </p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl p-6 shadow-card mb-8"
        >
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={searchType} onValueChange={(v: SearchType) => setSearchType(v)}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flight">Nº do Voo</SelectItem>
                  <SelectItem value="departure">Aeroporto Partida</SelectItem>
                  <SelectItem value="arrival">Aeroporto Chegada</SelectItem>
                  <SelectItem value="route">Rota (Origem → Destino)</SelectItem>
                  <SelectItem value="airline">Companhia Aérea</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={placeholders[searchType]}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  className="pl-9 h-11"
                />
              </div>

              {searchType === 'route' && (
                <>
                  <ArrowRightLeft className="w-5 h-5 text-muted-foreground self-center hidden sm:block" />
                  <div className="flex-1 relative">
                    <Input
                      placeholder="Destino (ex: GIG)"
                      value={query2}
                      onChange={e => setQuery2(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                      className="h-11"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="scheduled">Programado</SelectItem>
                  <SelectItem value="active">Em voo</SelectItem>
                  <SelectItem value="landed">Pousado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                  <SelectItem value="incident">Incidente</SelectItem>
                  <SelectItem value="diverted">Desviado</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={handleSearch} disabled={loading} className="gradient-sky text-primary-foreground h-11 sm:ml-auto">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                Buscar Voos
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {['GRU', 'GIG', 'BSB', 'SSA', 'CNF', 'POA', 'REC', 'FOR', 'CWB', 'VCP'].map(code => (
              <button
                key={code}
                onClick={() => { setQuery(code); setSearchType('departure'); }}
                className="text-xs bg-muted px-3 py-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-all"
              >
                {code}
              </button>
            ))}
          </div>
        </motion.div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
            <p className="text-muted-foreground">Buscando voos em tempo real...</p>
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="bg-card rounded-xl p-12 shadow-card text-center">
            <Plane className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-foreground">Nenhum voo encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">Tente outro termo de busca ou altere os filtros</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            <p className="text-sm text-muted-foreground mb-4">{results.length} voo(s) encontrado(s)</p>
            <div className="grid gap-4 md:grid-cols-2">
              {results.map((flight, i) => (
                <FlightCard key={`${flight.flight?.iata}-${i}`} flight={flight} index={i} />
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
