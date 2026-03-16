import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeftRight, Plus, Eye, MessageCircle, Send, Store } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDateBR } from '@/lib/date-utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

type Tab = 'marketplace' | 'my-offers' | 'my-proposals';

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

export default function FlightSwapPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('marketplace');
  const [offers, setOffers] = useState<any[]>([]);
  const [myOffers, setMyOffers] = useState<any[]>([]);
  const [myProposals, setMyProposals] = useState<any[]>([]);
  const [form, setForm] = useState({ flight_number: '', flight_date: '', departure_airport: '', arrival_airport: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [proposalMsg, setProposalMsg] = useState('');
  const [proposals, setProposals] = useState<any[]>([]);

  const loadAll = async () => {
    if (!user) { setOffers([]); setMyOffers([]); setMyProposals([]); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data: allOffers } = await sb.from('flight_swap_offers').select('*').order('created_at', { ascending: false });
    setOffers((allOffers || []).filter((o: any) => o.owner_user_id !== user.id && o.status === 'open'));
    setMyOffers((allOffers || []).filter((o: any) => o.owner_user_id === user.id));
    const { data: props } = await sb.from('flight_swap_proposals').select('*').eq('proposer_user_id', user.id).order('created_at', { ascending: false });
    setMyProposals(props || []);
  };

  useEffect(() => { loadAll(); }, [user]);

  const handleCreateOffer = async () => {
    if (!user || !form.flight_number) { toast.error('Informe o voo'); return; }
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('flight_swap_offers').insert({
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('flight_swap_proposals').insert({ offer_id: offerId, proposer_user_id: user.id, message: proposalMsg, status: 'sent' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('flight_swap_offers').update({ status: 'in_negotiation' }).eq('id', offerId);
    toast.success('Proposta enviada!');
    setProposalMsg('');
    setSelectedOffer(null);
    loadAll();
  };

  const handleUpdateOfferStatus = async (id: string, status: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('flight_swap_offers').update({ status }).eq('id', id);
    toast.success('Status atualizado');
    loadAll();
  };

  const handleProposalAction = async (proposalId: string, status: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('flight_swap_proposals').update({ status }).eq('id', proposalId);
    toast.success(`Proposta ${status === 'accepted' ? 'aceita' : 'rejeitada'}`);
    loadAll();
  };

  const loadProposalsForOffer = async (offerId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from('flight_swap_proposals').select('*').eq('offer_id', offerId).order('created_at', { ascending: false });
    setProposals(data || []);
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'marketplace', label: 'Marketplace', count: offers.length },
    { key: 'my-offers', label: 'Minhas Ofertas', count: myOffers.length },
    { key: 'my-proposals', label: 'Minhas Propostas', count: myProposals.length },
  ];

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Troca de Voo</h1>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm"><Plus className="w-4 h-4 mr-1" />Publicar Voo</Button>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${tab === t.key ? 'gradient-sky text-primary-foreground' : 'bg-card text-foreground hover:bg-muted shadow-card'}`}>
            {t.label} {t.count > 0 && <span className="ml-1 text-xs opacity-70">({t.count})</span>}
          </button>
        ))}
      </div>

      {tab === 'marketplace' && (
        <div className="space-y-3">
          {offers.length === 0 && <p className="text-center text-muted-foreground text-sm py-10">Nenhuma oferta disponível no momento</p>}
          {offers.map(o => (
            <div key={o.id} className="bg-card rounded-xl p-4 shadow-card border border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-primary" />
                  <p className="font-bold text-foreground">{o.flight_number}</p>
                  {o.flight_date && <span className="text-xs text-muted-foreground font-mono">{formatDateBR(o.flight_date)}</span>}
                </div>
                <Badge variant="outline">Disponível</Badge>
              </div>
              {(o.departure_airport || o.arrival_airport) && <p className="text-sm text-muted-foreground mb-1">{o.departure_airport || '?'} → {o.arrival_airport || '?'}</p>}
              {o.notes && <p className="text-sm text-muted-foreground mb-2">{o.notes}</p>}
              <Button size="sm" onClick={() => { setSelectedOffer(o); setProposalMsg(''); }}><MessageCircle className="w-4 h-4 mr-1" />Tenho interesse</Button>
            </div>
          ))}
        </div>
      )}

      {tab === 'my-offers' && (
        <div className="space-y-3">
          {myOffers.length === 0 && <p className="text-center text-muted-foreground text-sm py-10">Você ainda não publicou nenhum voo para troca</p>}
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
                {o.notes && <p className="text-sm text-muted-foreground mb-2">{o.notes}</p>}
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => { loadProposalsForOffer(o.id); setSelectedOffer({ ...o, _viewProposals: true }); }}><Eye className="w-4 h-4 mr-1" />Ver Propostas</Button>
                  {o.status !== 'cancelled' && o.status !== 'closed' && <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleUpdateOfferStatus(o.id, 'cancelled')}>Cancelar</Button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'my-proposals' && (
        <div className="space-y-3">
          {myProposals.length === 0 && <p className="text-center text-muted-foreground text-sm py-10">Você ainda não enviou nenhuma proposta</p>}
          {myProposals.map(p => {
            const s = PROPOSAL_STATUS[p.status] || PROPOSAL_STATUS.sent;
            return (
              <div key={p.id} className="bg-card rounded-xl p-4 shadow-card border border-border">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Proposta #{p.id.slice(0, 8)}</p>
                  <Badge variant={s.variant}>{s.label}</Badge>
                </div>
                <p className="text-sm text-foreground">{p.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatDateBR(p.created_at?.split('T')[0] || '')}</p>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={showCreate} onOpenChange={setShowCreate}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader><SheetTitle>Publicar Voo para Troca</SheetTitle></SheetHeader>
          <div className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Voo</Label><Input value={form.flight_number} onChange={e => setForm(f => ({ ...f, flight_number: e.target.value }))} placeholder="LA3456" /></div>
              <div><Label className="text-xs">Data</Label><Input type="date" value={form.flight_date} onChange={e => setForm(f => ({ ...f, flight_date: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Origem</Label><Input value={form.departure_airport} onChange={e => setForm(f => ({ ...f, departure_airport: e.target.value }))} placeholder="GRU" /></div>
              <div><Label className="text-xs">Destino</Label><Input value={form.arrival_airport} onChange={e => setForm(f => ({ ...f, arrival_airport: e.target.value }))} placeholder="BSB" /></div>
            </div>
            <Textarea placeholder="Observações" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            <Button onClick={handleCreateOffer} disabled={saving} className="w-full"><Plus className="w-4 h-4 mr-2" />Publicar</Button>
          </div>
        </SheetContent>
      </Sheet>

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
                        <Button size="sm" onClick={() => handleProposalAction(p.id, 'accepted')}>Aceitar</Button>
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
