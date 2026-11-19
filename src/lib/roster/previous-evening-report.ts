/**
 * Jornada que começa na noite anterior ao voo (apresentação 23:50 para saída 00:13): o voo é do dia
 * seguinte, mas a tripulante já trabalha no dia da apresentação. Sem isso, a Escala mostrava esse
 * dia vazio. Só para exibir: acrescenta no dia anterior um item "Apresentação HH:MM" do voo (id com
 * ":apresentacao"), que a lista mostra com "Voo LA… · BEL → MCP" embaixo.
 */
import type { ScheduleEntry } from '@/hooks/useScheduleData';

const minutes = (hhmm: string | null | undefined): number | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm ?? '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

const previousDay = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

export function reportsPreviousEvening(e: ScheduleEntry): boolean {
  const report = minutes(e.report_time);
  const departure = minutes(e.departure_time);
  return Boolean(e.is_flight) && report != null && departure != null && report > departure;
}

export function withPreviousEveningReports(entries: ScheduleEntry[]): ScheduleEntry[] {
  if (!entries.some(reportsPreviousEvening)) return entries;
  const out: ScheduleEntry[] = [];
  for (const e of entries) {
    if (reportsPreviousEvening(e)) {
      const day = previousDay(e.date);
      const report = String(e.report_time).trim().slice(0, 5).padStart(5, '0');
      out.push({
        ...e,
        id: `${e.id}:apresentacao`,
        date: day,
        // Item de apresentação (não é o voo): "Apresentação 23:50", dia contado como de voo.
        is_flight: false,
        entry_type: 'flight',
        activity_type: 'APR',
        crew_status_label: 'Apresentação',
        activity_label: 'Apresentação',
        departure_time: report,
        arrival_time: '',
        crosses_midnight: false,
        sort_datetime: `${day}T${report}:00`,
      });
    }
    out.push(e);
  }
  return out;
}
