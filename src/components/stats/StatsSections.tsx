/** Seções da tela de Estatísticas. Só formatam o que computeRosterStats calculou. */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import type { RosterStats } from '@/lib/stats/types';
import { RouteMap } from './RouteMap';
import { dayMonth, decimal1, hhmm, hShort, int, pct, plural } from './format';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Card({ title, aside, children }: { title?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      {title && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          {aside}
        </div>
      )}
      {children}
    </div>
  );
}

function Row({ label, value, hint, emoji }: { label: string; value: ReactNode; hint?: ReactNode; emoji?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-foreground">{emoji ? `${emoji} ${label}` : label}</span>
      <span className="text-right font-semibold text-foreground">
        {value}
        {hint && <span className="ml-1 font-normal text-muted-foreground">{hint}</span>}
      </span>
    </div>
  );
}

function BarList({ items }: { items: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ol className="space-y-2">
      {items.map((i, idx) => (
        <li key={i.label} className="grid grid-cols-[1.25rem_minmax(4.5rem,auto)_1fr_2rem] items-center gap-2 text-sm">
          <span className="text-xs text-muted-foreground">{idx + 1}</span>
          <span className="truncate font-semibold text-foreground">{i.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${(i.value / max) * 100}%` }} />
          </span>
          <span className="text-right font-semibold text-foreground">{i.value}</span>
        </li>
      ))}
    </ol>
  );
}

function Tile({ value, label, tone }: { value: string; label: string; tone: 'primary' | 'plain' | 'accent' }) {
  const color = tone === 'primary' ? 'text-primary' : tone === 'accent' ? 'text-accent-foreground' : 'text-foreground';
  return (
    <div className="rounded-2xl border border-border bg-card px-3 py-3 text-center shadow-sm">
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

export function SummarySection({ stats }: { stats: RosterStats }) {
  const { summary: s } = stats;
  return (
    <Section title="Resumo">
      <div className="grid grid-cols-3 gap-2">
        <Tile value={hhmm(s.flownMinutes)} label="Voadas" tone="primary" />
        <Tile value={hhmm(s.dutyMinutes)} label="Jornada" tone="plain" />
        <Tile value={String(s.daysOff)} label="Folgas" tone="plain" />
      </div>
      {s.efficiency != null && (
        <Card title="Eficiência da escala">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: pct(Math.min(1, s.efficiency)) }} />
          </div>
          <p className="text-sm text-muted-foreground">
            De cada 10h de jornada, {hShort(Math.min(1, s.efficiency) * 600)} voando — o resto é solo, espera e apresentação.
          </p>
        </Card>
      )}
      <Card title="Madrugadas">
        <Row label="Apresentações antes das 06h" value={s.earlyReports} />
        <Row label="Pousos entre 23h e 06h" value={s.lateLandings} />
      </Card>
    </Section>
  );
}

/** Metade ou mais dos fins de semana livres é festa; algum livre, sorriso; nenhum, cansaço. */
function weekendEmoji(free: number, total: number): string {
  if (free === 0) return '😓';
  return free * 2 >= total ? '🎉' : '🙂';
}

/** Emoji da descoberta pelo assunto da frase. */
function insightEmoji(text: string): string {
  if (/pernoite/i.test(text)) return '🏨';
  if (/folgas|fins? de semana/i.test(text)) return '🏖️';
  if (/madrugada/i.test(text)) return '🌅';
  if (/^Voou/.test(text)) return '🌍';
  if (/estreou/i.test(text)) return '✈️';
  return '💡';
}

export function QualitySection({ stats }: { stats: RosterStats }) {
  const { quality: q } = stats;
  const nights = q.nightsHome + q.nightsAway;
  return (
    <Section title="Qualidade de vida">
      <Card title="Suas noites no período">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: nights ? `${(q.nightsHome / nights) * 100}%` : '0%' }} />
          <div className="h-full bg-accent" style={{ width: nights ? `${(q.nightsAway / nights) * 100}%` : '0%' }} />
        </div>
        <p className="text-sm text-foreground">
          <span className="font-semibold">🏠 {q.nightsHome} em casa</span>
          {nights > 0 && <span className="text-muted-foreground"> · {pct(q.nightsHome / nights)}</span>}
          <span className="mx-2 text-muted-foreground">|</span>
          <span className="font-semibold">🧳 {q.nightsAway} fora</span>
          {nights > 0 && <span className="text-muted-foreground"> · {pct(q.nightsAway / nights)}</span>}
        </p>
        <Row emoji="🏨" label="Pernoites programados" value={q.layovers} />
        <Row emoji={weekendEmoji(q.weekendsFree, q.weekendsTotal)} label="Fins de semana livres" value={q.weekendsFree} hint={`de ${q.weekendsTotal}`} />
        <Row emoji="🏖️" label="Maior bloco de folga" value={plural(q.longestOffBlock, 'dia', 'dias')} />
        <Row emoji={q.longestWorkStreak >= 6 ? '😮‍💨' : '💪'} label="Maior sequência de trabalho" value={plural(q.longestWorkStreak, 'dia', 'dias')} />
        {q.baseInferred && (
          <div className="flex gap-3 border-t border-border pt-3">
            <Home className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Em que cidade você mora?</p>
              <p className="text-xs text-muted-foreground">
                Vale a própria base — é o que conta suas noites em casa e reconhece pernoite na sua cidade.
                {q.base ? ` Por enquanto usamos ${q.base}, de onde mais saem seus voos.` : ''}
              </p>
              <Link to="/settings" className="inline-block rounded-full border border-primary px-3 py-1.5 text-xs font-semibold text-primary">
                Informar no perfil
              </Link>
            </div>
          </div>
        )}
      </Card>
    </Section>
  );
}

export function FlightsSection({ stats }: { stats: RosterStats }) {
  const { flights: f } = stats;
  return (
    <Section title="Voos">
      <Card>
        <Row label="Pernas voadas" value={f.legs} />
        <Row label={`Deadheads (${f.deadheads})`} value={hhmm(f.deadheadMinutes)} hint="horas de deslocamento" />
        <Row label="Distância" value={`${int(f.distanceKm)} km`} hint={f.earthLaps >= 0.5 ? `≈ ${plural(Math.round(f.earthLaps), 'volta', 'voltas')} na Terra` : undefined} />
        {f.topRoute && <Row label="Rota mais voada" value={`${f.topRoute.from} → ${f.topRoute.to}`} hint={`${f.topRoute.count}×`} />}
        {f.busiestDay && <Row label="Mais pernas num dia" value={`${f.busiestDay.legs} em ${dayMonth(f.busiestDay.date)}`} />}
      </Card>
      <Card title="Horas diurnas e noturnas">
        <Row label="Horas diurnas" value={hhmm(f.dayMinutes)} />
        <Row label="Horas noturnas" value={hhmm(f.nightMinutes)} />
        <p className="text-xs text-muted-foreground">Diurnas: 06h–18h. Noturnas: 18h–06h, no fuso da base.</p>
      </Card>
      <Card title="Ritmo de voo">
        <Row label="Dias com voo operado" value={f.flightDays} />
        <Row label="Etapas por dia de voo" value={decimal1(f.legsPerDay)} />
        <Row label="Duração média por etapa" value={hhmm(f.avgLegMinutes)} />
        {f.longestLeg && <Row label="Etapa mais longa" value={hhmm(f.longestLeg.minutes)} hint={`${f.longestLeg.from} → ${f.longestLeg.to}`} />}
        {f.shortestLeg && <Row label="Etapa mais curta" value={hhmm(f.shortestLeg.minutes)} hint={`${f.shortestLeg.from} → ${f.shortestLeg.to}`} />}
      </Card>
    </Section>
  );
}

export function AirportsSection({ stats }: { stats: RosterStats }) {
  const { airports: a, quality: q } = stats;
  return (
    <Section title="Aeroportos">
      <Card title="Seu mapa de rotas">
        <RouteMap legs={a.mapLegs} />
        <p className="text-xs text-muted-foreground">Linhas ligam aeroportos; não representam a trajetória real. Cartografia: Natural Earth.</p>
      </Card>
      <Card
        title={`Aeroportos · ${a.distinct} diferentes`}
        aside={a.newAirports[0] ? <span className="rounded-full border border-primary/40 px-2 py-0.5 text-xs font-semibold text-primary">novo: {a.newAirports[0]}</span> : undefined}
      >
        <BarList items={a.byCount.slice(0, 5).map((x) => ({ label: x.iata, value: x.count }))} />
      </Card>
      {q.layoversByCity.length > 0 && (
        <Card title={`Pernoites por cidade · ${plural(q.layovers, 'noite', 'noites')}`}>
          <BarList items={q.layoversByCity.slice(0, 5).map((x) => ({ label: x.city, value: x.count }))} />
        </Card>
      )}
      {a.routes.length > 0 && (
        <Card title="Rotas mais voadas">
          <BarList items={a.routes.map((r) => ({ label: `${r.from} → ${r.to}`, value: r.count }))} />
        </Card>
      )}
    </Section>
  );
}

export function AircraftSection({ stats }: { stats: RosterStats }) {
  const { aircraft: ac } = stats;
  if (!ac.dominantType) return null;
  return (
    <Section title="Aeronaves">
      <Card>
        <Row label="Tipo dominante" value={ac.dominantType.type} hint={pct(ac.dominantType.share)} />
      </Card>
      <Card title="Etapas por tipo de aeronave">
        <BarList items={ac.byType.slice(0, 5).map((t) => ({ label: t.type, value: t.count }))} />
      </Card>
    </Section>
  );
}

export function InsightsSection({ insights }: { insights: string[] }) {
  if (insights.length === 0) return null;
  return (
    <Section title="Descobertas">
      <ul className="space-y-2">
        {insights.map((text) => (
          <li key={text} className="flex gap-3 rounded-2xl border border-border bg-card p-4 text-sm text-foreground shadow-sm">
            <span aria-hidden className="shrink-0 text-base leading-5">{insightEmoji(text)}</span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
