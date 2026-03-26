import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeftRight, Plus, Eye, MessageCircle, Send, Store, TrendingUp, MapPin, Lightbulb, Inbox } from 'lucide-react';
import { formatDateBR } from '@/lib/date-utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { Database } from '@/integrations/supabase/types';
import type { LucideIcon } from 'lucide-react';

type Tab = 'available' | 'my-base' | 'trending' | 'my-offers' | 'my-proposals' | 'received';

type OfferRow = Database['public']['Tables']['flight_swap_offers']['Row'];
type ProposalRow = Database['public']['Tables']['flight_swap_proposals']['Row'];
/** UI extensions for sheets / list enrichment */
type OfferWithUi = OfferRow & { _ownerBase?: string; _viewProposals?: boolean };

const OFFER_STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  open: { label: 'Aberta', variant: 'outline' },
  in_negotiation: { label: 'Em Negociação', variant: 'default' },
  accepted: { label: 'Aceita', variant: 'secondary' },
  rejected: { label: 'Rejeitada', variant: 'destructive' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
  closed: { label: 'Fechada', variant: 'secondary' },
};

const PROPOSAL_STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  sent: { label: 'Enviada', variant: 'outline' },
  accepted: { label: 'Aceita', variant: 'secondary' },
  rejected: { label: 'Rejeitada', variant: 'destructive' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
};

// ── Offer Card ──
function OfferCard({
  o,
  onInterest,
  showBase,
}: {
  o: OfferRow & { _ownerBase?: string };
  onInterest?: (o: OfferRow & { _ownerBase?: string }) => void;
  showBase?: boolean;
}) {
  const s = OFFER_STATUS[o.status] || OFFER_STATUS.open;
  return (
    <div className="bg-card rounded-xl p-4 shadow-card border border-border">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-primary" />
          <p className="font-bold text-foreground">{o.flight_number}</p>
          {o.flight_date && <span className="text-xs text-muted-foreground font-mono">{formatDateBR(o.flight_date)}</span>}
        </div>
        <Badge variant={s.variant}>{s.label}</Badge>
      </div>
      {(o.departure_airport || o.arrival_airport) && (
        <p className="text-sm text-muted-foreground mb-1">{o.departure_airport || '?'} → {o.arrival_airport || '?'}</p>
      )}
      {showBase && o._ownerBase && (
        <p className="text-xs text-primary flex items-center gap-1 mb-1"><MapPin className="w-3 h-3" />Base: {o._ownerBase}</p>
      )}
      {o.interest_count > 0 && (
        <p className="text-xs text-accent flex items-center gap-1 mb-1"><TrendingUp className="w-3 h-3" />{o.interest_count} interessado{o.interest_count > 1 ? 's' : ''}</p>
      )}
      {o.notes && <p className="text-sm text-muted-foreground mb-2">{o.notes}</p>}
      {onInterest && (
        <Button size="sm" onClick={() => onInterest(o)}><MessageCircle className="w-4 h-4 mr-1" />Tenho interesse</Button>
      )}
    </div>
  );
}

export default function FlightSwapPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('available');
  const [allOffers, setAllOffers] = useState<OfferRow[]>([]);
  const [myProposals, setMyProposals] = useState<ProposalRow[]>([]);
  const [receivedProposals, setReceivedProposals] = useState<ProposalRow[]>([]);
  const [form, setForm] = useState({ flight_number: '', flight_date: '', departure_airport: '', arrival_airport: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<OfferWithUi | null>(null);
  const [proposalMsg, setProposalMsg] = useState('');
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [userBase, setUserBase] = useState<string | null>(null);

  // ── Detect user base from active roster → profile → settings ──
  useEffect(() => {
    if (!user) return;
    (async () => {
      // 1) active roster
      const { data: activeRosters } = await supabase
        .from('imported_rosters')
        .select('base_airport, created_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5);

      const roster = (activeRosters ?? [])[0];

      if (roster?.base_airport) { setUserBase(roster.base_airport); return; }
      // 2) profile
      const { data: prof } = await supabase.from('profiles').select('airline').eq('user_id', user.id).maybeSingle();
      // profile doesn't have base_airport directly, fall to settings
      // 3) user_settings
      const { data: sets } = await supabase.from('user_settings').select('base_airport').eq('user_id', user.id).maybeSingle();
      if (sets?.base_airport) { setUserBase(sets.base_airport); return; }
      setUserBase(null);
    })();
  }, [user]);

  // ── Load all data ──
  const loadAll = async () => {
    if (!user) { setAllOffers([]); setMyProposals([]); setReceivedProposals([]); return; }
    const { data: offers } = await supabase.from('flight_swap_offers').select('*').order('created_at', { ascending: false });
    setAllOffers(offers || []);

    const { data: props } = await supabase.from('flight_swap_proposals').select('*').eq('proposer_user_id', user.id).order('created_at', { ascending: false });
    setMyProposals(props || []);

    // Received proposals = proposals on MY offers
    const myOfferIds = (offers || []).filter((o) => o.owner_user_id === user.id).map((o) => o.id);
    if (myOfferIds.length > 0) {
      const { data: recv } = await supabase.from('flight_swap_proposals').select('*').in('offer_id', myOfferIds).order('created_at', { ascending: false });
      setReceivedProposals(recv || []);
    } else {
      setReceivedProposals([]);
    }
  };

  useEffect(() => { loadAll(); }, [user]);

  // ── Derived lists ──
  const availableOffers = useMemo(() =>
    allOffers.filter(o => o.owner_user_id !== user?.id && o.status === 'open'),
    [allOffers, user]
  );

  const myBaseOffers = useMemo(() => {
    if (!userBase) return [];
    const base = userBase.toUpperCase();
    return availableOffers.filter(o =>
      o.departure_airport?.toUpperCase() === base ||
      o.arrival_airport?.toUpperCase() === base
    );
  }, [availableOffers, userBase]);

  const trendingOffers = useMemo(() =>
    [...availableOffers].sort((a, b) => (b.interest_count || 0) - (a.interest_count || 0) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10),
    [availableOffers]
  );

  const myOffers = useMemo(() =>
    allOffers.filter(o => o.owner_user_id === user?.id),
    [allOffers, user]
  );

  // ── Actions ──
  const handleCreateOffer = async () => {
    if (!user || !form.flight_number) { toast.error('Informe o voo'); return; }
    setSaving(true);
    await supabase.from('flight_swap_offers').insert({
      owner_user_id: user.id,
      flight_number: form.flight_number,
      flight_date: form.flight_date || null,
      departure_airport: form.departure_airport || null,
      arrival_airport: form.arrival_airport || null,
      notes: form.notes || null,
      status: 'open',
    });
    toast.success('Voo publicado para troca!');
    setForm({ flight_number: '', flight_date: '', departure_airport: '', arrival_airport: '', notes: '' });
    setShowCreate(false);
    setSaving(false);
    loadAll();
  };

  const handleSendProposal = async (offerId: string) => {
    if (!user || !proposalMsg.trim()) { toast.error('Escreva uma mensagem'); return; }
    await supabase.from('flight_swap_proposals').insert({ offer_id: offerId, proposer_user_id: user.id, message: proposalMsg, status: 'sent' });
    await supabase.from('flight_swap_offers').update({ status: 'in_negotiation', interest_count: (selectedOffer?.interest_count || 0) + 1 }).eq('id', offerId);
    toast.success('Proposta enviada!');
    setProposalMsg('');
    setSelectedOffer(null);
    loadAll();
  };

  const handleUpdateOfferStatus = async (id: string, status: string) => {
    await supabase.from('flight_swap_offers').update({ status }).eq('id', id);
    toast.success('Status atualizado');
    loadAll();
  };

  const handleProposalAction = async (proposalId: string, status: string, offerId?: string) => {
    await supabase.from('flight_swap_proposals').update({ status }).eq('id', proposalId);
    if (status === 'accepted' && offerId) {
      await supabase.from('flight_swap_offers').update({ status: 'accepted' }).eq('id', offerId);
    }
    toast.success(`Proposta ${status === 'accepted' ? 'aceita' : 'rejeitada'}`);
    loadAll();
  };

  const loadProposalsForOffer = async (offerId: string) => {
    const { data } = await supabase.from('flight_swap_proposals').select('*').eq('offer_id', offerId).order('created_at', { ascending: false });
    setProposals(data || []);
  };

  const openInterest = (o: OfferRow & { _ownerBase?: string }) => {
    setSelectedOffer(o);
    setProposalMsg('');
  };

  const tabs: { key: Tab; label: string; icon: LucideIcon; count: number }[] = [
    { key: 'available', label: 'Disponíveis', icon: Store, count: availableOffers.length },
    { key: 'my-base', label: 'Minha Base', icon: MapPin, count: myBaseOffers.length },
    { key: 'trending', label: 'Mais Procurados', icon: TrendingUp, count: trendingOffers.length },
    { key: 'my-offers', label: 'Minhas Ofertas', icon: ArrowLeftRight, count: myOffers.length },
    { key: 'my-proposals', label: 'Minhas Propostas', icon: Send, count: myProposals.length },
    { key: 'received', label: 'Recebidas', icon: Inbox, count: receivedProposals.length },
  ];

  const EmptyState = ({ msg }: { msg: string }) => (
    <p className="text-center text-muted-foreground text-sm py-10">{msg}</p>
  );

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Troca de Voo</h1>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm"><Plus className="w-4 h-4 mr-1" />Disponibilizar Voo</Button>
      </div>

      {/* User base badge */}
      {userBase && (
        <div className="flex items-center gap-1.5 mb-3 text-xs">
          <MapPin className="w-3.5 h-3.5 text-primary" />
          <span className="text-muted-foreground">Sua base:</span>
          <Badge variant="secondary" className="text-xs">{userBase}</Badge>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${tab === t.key ? 'gradient-sky text-primary-foreground shadow-sm' : 'bg-card text-foreground hover:bg-muted shadow-card'}`}>
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {t.count > 0 && <span className="ml-0.5 opacity-70">({t.count})</span>}
            </button>
          );
        })}
      </div>

      {/* ── Disponíveis ── */}
      {tab === 'available' && (
        <div className="space-y-3">
          {availableOffers.length === 0 && <EmptyState msg="Nenhuma oferta disponível no momento" />}
          {availableOffers.map(o => <OfferCard key={o.id} o={o} onInterest={openInterest} />)}
        </div>
      )}

      {/* ── Minha Base ── */}
      {tab === 'my-base' && (
        <div className="space-y-3">
          {!userBase && <EmptyState msg="Base não detectada. Importe uma escala ou configure em Ajustes." />}
          {userBase && myBaseOffers.length === 0 && <EmptyState msg={`Nenhuma oferta com origem/destino em ${userBase}`} />}
          {myBaseOffers.map(o => <OfferCard key={o.id} o={o} onInterest={openInterest} showBase />)}
        </div>
      )}

      {/* ── Mais Procurados ── */}
      {tab === 'trending' && (
        <div className="space-y-3">
          {trendingOffers.length === 0 && <EmptyState msg="Nenhuma oferta com interesse registrado" />}
          {trendingOffers.map((o, i) => (
            <div key={o.id} className="relative">
              {i < 3 && <div className="absolute -left-1 -top-1 w-6 h-6 rounded-full gradient-sky flex items-center justify-center text-[10px] font-bold text-primary-foreground z-10">{i + 1}</div>}
              <OfferCard o={o} onInterest={openInterest} />
            </div>
          ))}
        </div>
      )}

      {/* ── Minhas Ofertas ── */}
      {tab === 'my-offers' && (
        <div className="space-y-3">
          {myOffers.length === 0 && <EmptyState msg="Você ainda não publicou nenhum voo para troca" />}
          {myOffers.map(o => {
            const s = OFFER_STATUS[o.status] || OFFER_STATUS.open;
            return (
              <div key={o.id} className="bg-card rounded-xl p-4 shadow-card border border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-foreground">{o.flight_number}</p>
                    {o.flight_date && <span className="text-xs text-muted-foreground font-mono">{formatDateBR(o.flight_date)}</span>}
                  </div>
                  <Badge variant={s.variant}>{s.label}</Badge>
                </div>
                {(o.departure_airport || o.arrival_airport) && <p className="text-sm text-muted-foreground mb-1">{o.departure_airport || '?'} → {o.arrival_airport || '?'}</p>}
                {o.interest_count > 0 && <p className="text-xs text-accent mb-1">{o.interest_count} interessado{o.interest_count > 1 ? 's' : ''}</p>}
                {o.notes && <p className="text-sm text-muted-foreground mb-2">{o.notes}</p>}
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => { loadProposalsForOffer(o.id); setSelectedOffer({ ...o, _viewProposals: true }); }}><Eye className="w-4 h-4 mr-1" />Ver Propostas</Button>
                  {o.status !== 'cancelled' && o.status !== 'closed' && o.status !== 'accepted' && (
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleUpdateOfferStatus(o.id, 'cancelled')}>Cancelar</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Minhas Propostas ── */}
      {tab === 'my-proposals' && (
        <div className="space-y-3">
          {myProposals.length === 0 && <EmptyState msg="Você ainda não enviou nenhuma proposta" />}
          {myProposals.map(p => {
            const s = PROPOSAL_STATUS[p.status] || PROPOSAL_STATUS.sent;
            const offer = allOffers.find((o) => o.id === p.offer_id);
            return (
              <div key={p.id} className="bg-card rounded-xl p-4 shadow-card border border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {offer && <p className="font-medium text-foreground text-sm">{offer.flight_number}</p>}
                    <p className="text-xs text-muted-foreground">#{p.id.slice(0, 8)}</p>
                  </div>
                  <Badge variant={s.variant}>{s.label}</Badge>
                </div>
                <p className="text-sm text-foreground">{p.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatDateBR(p.created_at?.split('T')[0] || '')}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Solicitações Recebidas ── */}
      {tab === 'received' && (
        <div className="space-y-3">
          {receivedProposals.length === 0 && <EmptyState msg="Nenhuma proposta recebida nas suas ofertas" />}
          {receivedProposals.map(p => {
            const s = PROPOSAL_STATUS[p.status] || PROPOSAL_STATUS.sent;
            const offer = allOffers.find((o) => o.id === p.offer_id);
            return (
              <div key={p.id} className="bg-card rounded-xl p-4 shadow-card border border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {offer && <p className="font-medium text-foreground text-sm">{offer.flight_number}</p>}
                    <p className="text-xs text-muted-foreground">De: {p.proposer_user_id.slice(0, 8)}...</p>
                  </div>
                  <Badge variant={s.variant}>{s.label}</Badge>
                </div>
                <p className="text-sm text-foreground mb-2">{p.message}</p>
                <p className="text-xs text-muted-foreground mb-2">{formatDateBR(p.created_at?.split('T')[0] || '')}</p>
                {p.status === 'sent' && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleProposalAction(p.id, 'accepted', p.offer_id)}>Aceitar</Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleProposalAction(p.id, 'rejected')}>Rejeitar</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Sheet ── */}
      <Sheet open={showCreate} onOpenChange={setShowCreate}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader><SheetTitle>Disponibilizar Voo para Troca</SheetTitle></SheetHeader>
          <div className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Voo</Label><Input value={form.flight_number} onChange={e => setForm(f => ({ ...f, flight_number: e.target.value }))} placeholder="LA3456" /></div>
              <div><Label className="text-xs">Data</Label><Input type="date" value={form.flight_date} onChange={e => setForm(f => ({ ...f, flight_date: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Origem</Label><Input value={form.departure_airport} onChange={e => setForm(f => ({ ...f, departure_airport: e.target.value }))} placeholder={userBase || 'GRU'} /></div>
              <div><Label className="text-xs">Destino</Label><Input value={form.arrival_airport} onChange={e => setForm(f => ({ ...f, arrival_airport: e.target.value }))} placeholder="BSB" /></div>
            </div>
            <Textarea placeholder="Observações" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            <Button onClick={handleCreateOffer} disabled={saving} className="w-full"><Plus className="w-4 h-4 mr-2" />Publicar</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Proposal / View Sheet ── */}
      <Sheet open={!!selectedOffer} onOpenChange={() => setSelectedOffer(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedOffer?._viewProposals ? 'Propostas Recebidas' : `Propor troca — ${selectedOffer?.flight_number}`}</SheetTitle>
          </SheetHeader>
          {selectedOffer && !selectedOffer._viewProposals && (
            <div className="space-y-3 mt-4">
              <p className="text-sm text-muted-foreground">{selectedOffer.departure_airport} → {selectedOffer.arrival_airport} • {selectedOffer.flight_date ? formatDateBR(selectedOffer.flight_date) : 'Data não informada'}</p>
              <Textarea value={proposalMsg} onChange={e => setProposalMsg(e.target.value)} placeholder="Descreva sua proposta de troca..." rows={3} />
              <Button onClick={() => handleSendProposal(selectedOffer.id)} className="w-full"><Send className="w-4 h-4 mr-2" />Enviar Proposta</Button>
            </div>
          )}
          {selectedOffer?._viewProposals && (
            <div className="space-y-3 mt-4">
              {proposals.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma proposta recebida ainda</p>}
              {proposals.map(p => {
                const s = PROPOSAL_STATUS[p.status] || PROPOSAL_STATUS.sent;
                return (
                  <div key={p.id} className="bg-muted/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">De: {p.proposer_user_id.slice(0, 8)}...</p>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </div>
                    <p className="text-sm text-foreground mb-2">{p.message}</p>
                    {p.status === 'sent' && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleProposalAction(p.id, 'accepted', selectedOffer.id)}>Aceitar</Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleProposalAction(p.id, 'rejected')}>Rejeitar</Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
