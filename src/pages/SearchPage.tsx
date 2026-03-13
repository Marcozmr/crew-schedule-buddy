import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { FlightCard } from '@/components/FlightCard';
import { searchFlights } from '@/lib/aviation-api';
import { FlightInfo } from '@/lib/types';
import { Search, Plane, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'flight' | 'departure' | 'arrival'>('flight');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [results, setResults] = useState<FlightInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);

    const params: Record<string, string> = {};
    const q = query.trim().toUpperCase();

    if (q) {
      if (searchType === 'flight') {
        params.flight_iata = q;
      } else if (searchType === 'departure') {
        params.dep_iata = q;
      } else {
        params.arr_iata = q;
      }
    }

    if (statusFilter && statusFilter !== 'all') {
      params.flight_status = statusFilter;
    }

    try {
      const data = await searchFlights(params);
      setResults(data);
      if (data.length === 0) {
        toast.info('Nenhum voo encontrado');
      }
    } catch {
      toast.error('Erro ao buscar voos');
    }

    setLoading(false);
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-2">Buscar Voos</h1>
        <p className="text-muted-foreground mb-8">
          Pesquise voos em tempo real por número, aeroporto de partida ou chegada.
        </p>

        {/* Search Form */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl p-6 shadow-card mb-8"
        >
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Select value={searchType} onValueChange={(v: 'flight' | 'departure' | 'arrival') => setSearchType(v)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flight">Nº do Voo</SelectItem>
                <SelectItem value="departure">Aeroporto Partida</SelectItem>
                <SelectItem value="arrival">Aeroporto Chegada</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={searchType === 'flight' ? 'Ex: JJ3401 ou G3 1234' : 'Ex: GRU, GIG, BSB'}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="pl-9 h-11"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="scheduled">Programado</SelectItem>
                <SelectItem value="active">Em voo</SelectItem>
                <SelectItem value="landed">Pousado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={handleSearch} disabled={loading} className="gradient-sky text-primary-foreground h-11">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {['GRU', 'GIG', 'BSB', 'SSA', 'CNF', 'POA', 'REC', 'FOR'].map(code => (
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

        {/* Results */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
            <p className="text-muted-foreground">Buscando voos...</p>
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="bg-card rounded-xl p-12 shadow-card text-center">
            <Plane className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-foreground">Nenhum voo encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">Tente outro termo de busca</p>
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
