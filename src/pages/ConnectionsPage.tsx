/**
 * Conexões: quem do EscalaX voa com você. Três abas práticas — próximos voos com colegas, colegas
 * (com folgas e pernoites em comum ao tocar) e conversas. Os dados vêm das RPCs que só revelam um
 * colega quando vocês estão no mesmo voo ou já voaram juntos.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Loader2, MessageCircle, Plane, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/lib/auth-context';
import {
  CrewDiscoveryService,
  type CrewConnectionEntry,
  type RosterCrewmateEntry,
} from '@/lib/services/crew-discovery-service';
import { CrewConversationService, type CrewConversationSummary } from '@/lib/services/crew-conversation-service';
import { useScheduleData } from '@/hooks/useScheduleData';
import { sameRosterPartners } from '@/lib/connections/same-roster';

type Tab = 'voos' | 'colegas' | 'conversas';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
/** "2026-03-21" → "21/mar". */
const dayMonth = (iso: string) => `${Number(iso.slice(8, 10))}/${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ''}`;
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
const today = () => new Date().toISOString().slice(0, 10);

const APP_URL = 'https://escalax-app.vercel.app';

async function invite() {
  const text = 'Estou usando o EscalaX para acompanhar minha escala e ver quem voa comigo. Baixe também:';
  try {
    if (navigator.share) {
      await navigator.share({ title: 'EscalaX', text, url: APP_URL });
      return;
    }
    await navigator.clipboard.writeText(`${text} ${APP_URL}`);
    toast.success('Convite copiado — é só colar no grupo da tripulação.');
  } catch {
    /* compartilhamento cancelado */
  }
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-10 w-10 text-xs';
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent font-bold text-primary-foreground ${cls}`}>
      {initials(name) || '?'}
    </span>
  );
}

function Empty({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-card/60 px-6 py-10 text-center">
      <span className="text-4xl" aria-hidden>
        {emoji}
      </span>
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{text}</p>
      <button type="button" onClick={invite} className="mt-1 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm active:scale-95">
        <Share2 className="h-4 w-4" /> Convidar colegas
      </button>
    </div>
  );
}

function FlightsTab({ crewmates, chatFor }: { crewmates: RosterCrewmateEntry[]; chatFor: (id: string) => string | null }) {
  // Um cartão por dia: os voos do dia e quem do EscalaX está em algum deles (sem repetir a pessoa).
  const flights = useMemo(() => {
    type Leg = { flight: string; from: string | null; to: string | null };
    const groups = new Map<string, { date: string; legs: Leg[]; crew: RosterCrewmateEntry[] }>();
    for (const c of crewmates) {
      if (c.flightDate < today()) continue;
      const g = groups.get(c.flightDate) ?? { date: c.flightDate, legs: [], crew: [] };
      if (!g.legs.some((l) => l.flight === c.flightNumber)) g.legs.push({ flight: c.flightNumber, from: c.departure, to: c.arrival });
      if (!g.crew.some((x) => x.partnerUserId === c.partnerUserId)) g.crew.push(c);
      groups.set(c.flightDate, g);
    }
    return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [crewmates]);

  if (flights.length === 0) {
    return <Empty emoji="✈️" title="Ninguém do EscalaX nos seus próximos voos" text="Quando um colega que usa o app estiver na mesma tripulação, ele aparece aqui." />;
  }
  return (
    <ul className="space-y-3">
      {flights.map((f) => (
        <li key={f.date} className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
            <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <span className="text-lg font-bold leading-none">{Number(f.date.slice(8, 10))}</span>
              <span className="text-[10px] font-semibold uppercase">{MONTHS[Number(f.date.slice(5, 7)) - 1]}</span>
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              {f.legs.map((l) => (
                <p key={l.flight} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-mono text-sm font-bold text-foreground">{l.flight}</span>
                  {l.from ?? '—'} <Plane className="h-3 w-3" /> {l.to ?? '—'}
                </p>
              ))}
            </div>
            <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-foreground">
              {f.crew.length} {f.crew.length === 1 ? 'colega' : 'colegas'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {f.crew.map((c) => {
              const chat = chatFor(c.partnerUserId);
              const chip = (
                <>
                  <Avatar name={c.partnerName} size="sm" />
                  <span className="text-sm font-medium text-foreground">{c.partnerName}</span>
                  {c.crewRole && <span className="text-[10px] font-semibold uppercase text-muted-foreground">{c.crewRole}</span>}
                  {chat && <MessageCircle className="h-3.5 w-3.5 text-primary" />}
                </>
              );
              return chat ? (
                <Link key={c.partnerUserId} to={`/connections/chat/${chat}`} className="flex items-center gap-2 rounded-full border border-border bg-background py-1 pl-1 pr-3 active:scale-95">
                  {chip}
                </Link>
              ) : (
                <span key={c.partnerUserId} className="flex items-center gap-2 rounded-full border border-border bg-background py-1 pl-1 pr-3">
                  {chip}
                </span>
              );
            })}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ColleagueCard({ c }: { c: CrewConnectionEntry }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [shared, setShared] = useState<{ daysOff: string[]; layovers: Array<{ date: string; city: string }> } | null>(null);

  useEffect(() => {
    if (!open || shared) return;
    let cancelled = false;
    Promise.all([CrewDiscoveryService.getSharedDaysOff(c.partnerUserId), CrewDiscoveryService.getSharedLayovers(c.partnerUserId)]).then(([daysOff, layovers]) => {
      if (!cancelled) setShared({ daysOff: daysOff.filter((d) => d >= today()).sort(), layovers: layovers.filter((l) => l.date >= today()).sort((a, b) => a.date.localeCompare(b.date)) });
    });
    return () => {
      cancelled = true;
    };
  }, [open, shared, c.partnerUserId]);

  return (
    <li className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <Avatar name={c.partnerName} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{c.partnerName}</span>
          <span className="block text-xs text-muted-foreground">
            {c.flightsTogetherCount} {c.flightsTogetherCount === 1 ? 'voo juntos' : 'voos juntos'}
            {c.partnerAirline ? ` · ${c.partnerAirline}` : ''}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-border/60">
            <div className="space-y-3 px-4 py-3">
              {!shared ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cruzando as escalas…
                </p>
              ) : (
                <>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-foreground">🏖️ Folgas em comum</p>
                    {shared.daysOff.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {shared.daysOff.slice(0, 8).map((d) => (
                          <span key={d} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                            {dayMonth(d)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhuma folga em comum por enquanto.</p>
                    )}
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-foreground">🏨 Pernoites na mesma cidade</p>
                    {shared.layovers.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {shared.layovers.slice(0, 8).map((l) => (
                          <span key={`${l.date}${l.city}`} className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-foreground">
                            {dayMonth(l.date)} · {l.city}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhum pernoite juntos por enquanto.</p>
                    )}
                  </div>
                </>
              )}
              {c.conversationId && (
                <button type="button" onClick={() => navigate(`/connections/chat/${c.conversationId}`)} className="inline-flex items-center gap-2 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground active:scale-95">
                  <MessageCircle className="h-3.5 w-3.5" /> Conversar
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function ConversationsTab({ conversations }: { conversations: CrewConversationSummary[] }) {
  if (conversations.length === 0) {
    return <Empty emoji="💬" title="Nenhuma conversa ainda" text="A conversa com um colega abre sozinha depois que vocês voam juntos mais de uma vez." />;
  }
  return (
    <ul className="space-y-2">
      {conversations.map((c) => (
        <li key={c.id}>
          <Link to={`/connections/chat/${c.id}`} className="flex items-center gap-3 rounded-3xl border border-border bg-card px-4 py-3 shadow-sm active:scale-[0.99]">
            <Avatar name={c.partnerName} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{c.partnerName}</span>
              <span className="block truncate text-xs text-muted-foreground">{c.lastMessagePreview ?? 'Diga olá 👋'}</span>
            </span>
            {c.lastMessageAt && <span className="shrink-0 text-[11px] text-muted-foreground">{dayMonth(c.lastMessageAt.slice(0, 10))}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function ConnectionsPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const [tab, setTab] = useState<Tab>('voos');
  const [loading, setLoading] = useState(true);
  const [crewmates, setCrewmates] = useState<RosterCrewmateEntry[]>([]);
  const [connections, setConnections] = useState<CrewConnectionEntry[]>([]);
  const [conversations, setConversations] = useState<CrewConversationSummary[]>([]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.all([CrewDiscoveryService.getRosterCrewmates(), CrewDiscoveryService.listConnections(), CrewConversationService.listConversations(userId)]).then(([cm, cn, cv]) => {
      if (cancelled) return;
      setCrewmates(cm);
      setConnections([...cn].sort((a, b) => b.flightsTogetherCount - a.flightsTogetherCount));
      setConversations(cv);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Mesma escala em outra conta: não é colega. Some das abas e vira só um aviso.
  const { schedule } = useScheduleData();
  const myFlightCount = useMemo(() => schedule.filter((e) => e.is_flight).length, [schedule]);
  const sameRoster = useMemo(() => sameRosterPartners(connections, myFlightCount), [connections, myFlightCount]);
  const sameRosterNames = useMemo(() => connections.filter((c) => sameRoster.has(c.partnerUserId)).map((c) => c.partnerName), [connections, sameRoster]);
  const realCrewmates = useMemo(() => crewmates.filter((c) => !sameRoster.has(c.partnerUserId)), [crewmates, sameRoster]);
  const realConnections = useMemo(() => connections.filter((c) => !sameRoster.has(c.partnerUserId)), [connections, sameRoster]);
  const realConversations = useMemo(() => conversations.filter((c) => !sameRoster.has(c.partnerId)), [conversations, sameRoster]);
  // Colegas com voo na escala ativa (próximos voos) x quem só voou junto em escalas antigas.
  const inCurrentRoster = useMemo(() => new Set(realCrewmates.map((c) => c.partnerUserId)), [realCrewmates]);

  const chatFor = useMemo(() => {
    const byPartner = new Map(connections.filter((c) => c.conversationId).map((c) => [c.partnerUserId, c.conversationId as string]));
    return (id: string) => byPartner.get(id) ?? null;
  }, [connections]);

  const upcoming = useMemo(() => new Set(realCrewmates.filter((c) => c.flightDate >= today()).map((c) => c.flightDate)).size, [realCrewmates]);
  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'voos', label: 'Voos', count: upcoming },
    { id: 'colegas', label: 'Colegas', count: realConnections.length },
    { id: 'conversas', label: 'Conversas', count: realConversations.length },
  ];

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-5 pb-10">
        <header className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Conexões</h1>
            <p className="text-sm text-muted-foreground">Quem voa com você no EscalaX</p>
          </div>
          <button type="button" onClick={invite} aria-label="Convidar colegas" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-sm active:scale-95">
            <Share2 className="h-3.5 w-3.5 text-primary" /> Convidar
          </button>
        </header>

        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`relative rounded-xl px-2 py-2 text-xs font-semibold transition-colors ${tab === t.id ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              {tab === t.id && <motion.span layoutId="connections-tab" className="absolute inset-0 rounded-xl bg-card shadow-sm" />}
              <span className="relative">
                {t.label}
                {t.count > 0 && <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-[10px] text-primary">{t.count}</span>}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Procurando colegas…
          </p>
        ) : (
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            {tab === 'voos' && <FlightsTab crewmates={realCrewmates} chatFor={chatFor} />}
            {tab === 'colegas' &&
              (realConnections.length === 0 ? (
                <Empty emoji="🤝" title="Seus colegas aparecem aqui" text="Depois de voar com alguém que usa o EscalaX, veja as folgas e os pernoites que vocês têm em comum." />
              ) : (
                <div className="space-y-5">
                  {[
                    { title: 'Na sua escala atual', items: realConnections.filter((c) => inCurrentRoster.has(c.partnerUserId)) },
                    { title: 'Já voaram juntos', items: realConnections.filter((c) => !inCurrentRoster.has(c.partnerUserId)) },
                  ]
                    .filter((s) => s.items.length > 0)
                    .map((s) => (
                      <section key={s.title} aria-label={s.title} className="space-y-2">
                        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">{s.title}</h2>
                        <ul className="space-y-3">
                          {s.items.map((c) => (
                            <ColleagueCard key={c.partnerUserId} c={c} />
                          ))}
                        </ul>
                      </section>
                    ))}
                </div>
              ))}
            {tab === 'conversas' && <ConversationsTab conversations={realConversations} />}
          </motion.div>
        )}

        {!loading && sameRosterNames.length > 0 && (
          <p className="rounded-2xl bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
            🪞 A conta de {sameRosterNames.join(', ')} tem a mesma escala que a sua, então não aparece como colega. Colegas
            de verdade aparecem aqui quando também usam o EscalaX.
          </p>
        )}
      </div>
    </AppLayout>
  );
}
