import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumericInput, safeParseNumber } from '@/components/ui/numeric-input';
import { toast } from 'sonner';
import { UtensilsCrossed, Plus, Trash2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDateBR } from '@/lib/date-utils';
import type { Database } from '@/integrations/supabase/types';

type PerDiemRow = Database['public']['Tables']['perdiem_entries']['Row'];

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function EntryCard({ entry, onDelete }: { entry: PerDiemRow; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const total = Number(entry.total_value || 0);
  const unitValue = Number(entry.unit_value || 0);
  const qty = Number(entry.quantity || 1);

  return (
    <div className="rounded-2xl border border-border/70 bg-card overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <UtensilsCrossed className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">{entry.location || 'Sem local'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatDateBR(entry.date)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-foreground">{fmtBRL(total)}</p>
          {qty > 1 && <p className="text-[10px] text-muted-foreground">{qty}× {fmtBRL(unitValue)}</p>}
        </div>
        <div className="ml-1 text-muted-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-border/50 space-y-2">
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="bg-muted/40 rounded-xl p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Quantidade</p>
                  <p className="text-sm font-bold text-foreground">{qty}</p>
                </div>
                <div className="bg-muted/40 rounded-xl p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Valor unit.</p>
                  <p className="text-sm font-bold text-foreground">{fmtBRL(unitValue)}</p>
                </div>
                <div className="bg-primary/10 rounded-xl p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Total</p>
                  <p className="text-sm font-bold text-primary">{fmtBRL(total)}</p>
                </div>
              </div>
              {entry.notes && (
                <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">{entry.notes}</p>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 mt-1"
                onClick={onDelete}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Excluir diária
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AddEntrySheet({ onAdded }: { onAdded: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: '', location: '', quantity: 1 as number | null, unit_value: null as number | null, notes: '' });

  const displayTotal = safeParseNumber(form.quantity, 1) * safeParseNumber(form.unit_value);

  const handleAdd = async () => {
    if (!user || !form.date) { toast.error('Preencha a data'); return; }
    setSaving(true);
    const qty = safeParseNumber(form.quantity, 1);
    const uv = safeParseNumber(form.unit_value);
    await supabase.from('perdiem_entries').insert({
      user_id: user.id, date: form.date, location: form.location,
      quantity: qty, unit_value: uv, total_value: qty * uv, notes: form.notes || null,
    });
    toast.success('Diária adicionada!');
    setForm({ date: '', location: '', quantity: 1, unit_value: null, notes: '' });
    setSaving(false);
    setOpen(false);
    onAdded();
  };

  return (
    <>
      <Button className="w-full rounded-xl" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 mr-2" />Nova Diária
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end bg-black/50"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="w-full bg-card rounded-t-3xl p-6 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-2" />
              <h3 className="text-base font-bold text-foreground">Nova Diária</h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Data</Label>
                  <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Local</Label>
                  <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="GRU" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Quantidade</Label>
                  <NumericInput value={form.quantity} onValueChange={v => setForm(f => ({ ...f, quantity: v }))} min={1} decimals={0} blurDefault={1} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Valor Unitário (R$)</Label>
                  <NumericInput value={form.unit_value} onValueChange={v => setForm(f => ({ ...f, unit_value: v }))} decimals={2} className="mt-1" />
                </div>
              </div>

              <Input
                placeholder="Observações (opcional)"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />

              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-xs text-muted-foreground">Total a lançar</p>
                  <p className="text-lg font-bold text-foreground">{fmtBRL(displayTotal)}</p>
                </div>
                <Button className="rounded-xl px-6" onClick={handleAdd} disabled={saving || !form.date}>
                  {saving ? 'Salvando…' : 'Adicionar'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function PerDiemPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<PerDiemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear] = useState(new Date().getFullYear());

  const load = async () => {
    if (!user) { setEntries([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('perdiem_entries').select('*').eq('user_id', user.id)
      .order('date', { ascending: false }).limit(200);
    setEntries(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleDelete = async (id: string) => {
    if (!user) return;
    await supabase.from('perdiem_entries').delete().eq('id', id).eq('user_id', user.id);
    toast.success('Excluída');
    load();
  };

  const monthEntries = useMemo(() => {
    const prefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    return entries.filter(e => e.date?.startsWith(prefix));
  }, [entries, selectedMonth, selectedYear]);

  const totalMonth = useMemo(() => monthEntries.reduce((s, e) => s + Number(e.total_value || 0), 0), [monthEntries]);
  const uniqueDays = useMemo(() => new Set(monthEntries.map(e => e.date)).size, [monthEntries]);
  const uniqueLocations = useMemo(() => new Set(monthEntries.map(e => e.location).filter(Boolean)).size, [monthEntries]);

  // group by location for breakdown
  const byLocation = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    for (const e of monthEntries) {
      const key = e.location || 'Sem local';
      if (!map[key]) map[key] = { count: 0, total: 0 };
      map[key].count += 1;
      map[key].total += Number(e.total_value || 0);
    }
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [monthEntries]);

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Hero total card */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden p-5"
          style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.7) 100%)' }}
        >
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 60%)' }} />
          <div className="relative">
            <p className="text-primary-foreground/80 text-sm font-medium">Total de Diárias</p>
            <p className="text-primary-foreground text-4xl font-extrabold tracking-tight mt-1">
              {fmtBRL(totalMonth)}
            </p>
            <div className="flex items-center gap-4 mt-3">
              <div>
                <p className="text-primary-foreground/70 text-[11px]">Registros</p>
                <p className="text-primary-foreground text-lg font-bold">{monthEntries.length}</p>
              </div>
              <div className="w-px h-8 bg-primary-foreground/20" />
              <div>
                <p className="text-primary-foreground/70 text-[11px]">Dias</p>
                <p className="text-primary-foreground text-lg font-bold">{uniqueDays}</p>
              </div>
              <div className="w-px h-8 bg-primary-foreground/20" />
              <div>
                <p className="text-primary-foreground/70 text-[11px]">Locais</p>
                <p className="text-primary-foreground text-lg font-bold">{uniqueLocations}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Month selector */}
        <div className="glass px-4 py-2.5 flex items-center justify-between gap-2">
          <button
            onClick={() => setSelectedMonth(m => Math.max(0, m - 1))}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-foreground">{MONTHS[selectedMonth]} {selectedYear}</span>
          <button
            onClick={() => setSelectedMonth(m => Math.min(11, m + 1))}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Breakdown by location */}
        {byLocation.length > 0 && (
          <div className="glass p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Por local</p>
            {byLocation.map(([loc, stats]) => {
              const pct = totalMonth > 0 ? (stats.total / totalMonth) * 100 : 0;
              return (
                <div key={loc} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-foreground font-medium">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      {loc}
                    </span>
                    <span className="font-bold text-foreground">{fmtBRL(stats.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{stats.count} registro{stats.count !== 1 ? 's' : ''}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Add button */}
        <AddEntrySheet onAdded={load} />

        {/* Entry list */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : monthEntries.length === 0 ? (
          <div className="text-center py-12">
            <UtensilsCrossed className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma diária em {MONTHS[selectedMonth]}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {monthEntries.map(e => (
              <EntryCard key={e.id} entry={e} onDelete={() => handleDelete(e.id)} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
