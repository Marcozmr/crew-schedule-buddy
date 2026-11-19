/** Frases curtas de "Descobertas" a partir das estatísticas (só quando o dado existe; máx. 5). */
import type { RosterStats } from './types';

export type InsightScope = 'month' | 'year' | 'all';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const km = (n: number) => Math.round(n).toLocaleString('pt-BR');

function joinPt(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

function earthLapsText(laps: number): string {
  if (laps < 0.5) return `≈ ${Math.max(1, Math.round(laps * 100))}% de uma volta na Terra 🌎`;
  const n = Math.round(laps);
  return `≈ ${plural(n, 'volta', 'voltas')} na Terra 🌎`;
}

export function buildInsights(stats: RosterStats, scope: InsightScope = 'month'): string[] {
  const out: string[] = [];
  const { quality: q, summary: s, flights: f, airports: a } = stats;

  if (q.layovers > 0) {
    const cities = q.layoversByCity.length;
    let text = `Teve ${plural(q.layovers, 'pernoite programado', 'pernoites programados')} — ${plural(cities, 'cidade', 'cidades')}.`;
    if (cities > 1) text += ` Destino mais frequente: ${q.layoversByCity[0].city} (${plural(q.layoversByCity[0].count, 'noite', 'noites')}).`;
    out.push(text);
  }

  if (s.daysOff > 0 && q.weekendsTotal > 0) {
    const pct = Math.round((q.daysOffOnWeekend / s.daysOff) * 100);
    out.push(
      `${pct}% das suas folgas caíram em fim de semana. Você teve ${plural(q.weekendsFree, 'fim de semana livre', 'fins de semana livres')} de ${q.weekendsTotal}.`,
    );
  }

  if (s.earlyReports > 0 && f.flightDays > 0) {
    const every = Math.max(1, Math.round(f.flightDays / s.earlyReports));
    out.push(`${plural(s.earlyReports, 'madrugada', 'madrugadas')} — você se apresentou antes das 06h em 1 a cada ${plural(every, 'dia', 'dias')} de voo.`);
  }

  if (f.distanceKm > 0) {
    out.push(`Voou ${km(f.distanceKm)} km — ${earthLapsText(f.earthLaps)}.`);
  }

  if (scope !== 'all' && a.newAirports.length > 0) {
    const what = a.newAirports.length > 3 ? `${a.newAirports.length} aeroportos` : joinPt(a.newAirports);
    out.push(`Você estreou ${what} ${scope === 'year' ? 'este ano' : 'este mês'} — já são ${a.totalOperated} aeroportos operados.`);
  }

  return out.slice(0, 5);
}
