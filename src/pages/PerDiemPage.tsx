import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useScheduleData } from '@/hooks/useScheduleData';
import { groupIntoDutyPeriods } from '@/lib/duty-grouping';
import {
  computeDutyPerDiem,
  loadRates,
  saveRates,
  MEAL_LABEL,
  MEAL_EMOJI,
  DEFAULT_RATES,
  type MealRates,
  type ComputedDutyPerDiem,
} from '@/lib/perdiem-calc';
import { NumericInput } from '@/components/ui/numeric-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Settings2, CalendarClock } from 'lucide-react';
import { Link } from 'react-router-dom';

// ── helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEK_DAY_SHORT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dutyDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  const wd = WEEK_DAY_SHORT[d.getDay()];
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  return `${wd}., ${day}/${mon}`;
}

// ── RatesSheet ─────────────────────────────────────────────────────────────

function RatesSheet({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState<MealRates>(() => loadRates());

  const handleSave = () => {
    saveRates(draft);
    onClose();
    window.dispatchEvent(new Event('perdiem-rates-updated'));
  };

  const field = (label: string, key: keyof MealRates) => (
    <div key={key}>
      <Label className="text-xs text-muted-foreground">{MEAL_EMOJI[key]} {label}</Label>
      <NumericInput
        value={draft[key]}
        onValueChange={v => setDraft(r => ({ ...r, [key]: v ?? 0 }))}
        decimals={2}
        className="mt-1"
        placeholder="0,00"
      />
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full bg-card rounded-t-3xl p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-border mx-auto" />
        <div>
          <h3 className="text-base font-bold text-foreground">Configurar Taxas</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Valores por refeição para cálculo automático</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {field('Café da Manhã', 'breakfast')}
          {field('Almoço', 'lunch')}
          {field('Jantar', 'dinner')}
          {field('Pernoite', 'overnight')}
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 rounded-xl" onClick={handleSave}>Salvar</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── DutyPerDiemCard ─────────────────────────────────────────────────────────

function DutyPerDiemCard({ entry }: { entry: ComputedDutyPerDiem }) {
  const [open, setOpen] = useState(false);

  const mealIcons = [...new Set(entry.meals.map(m => MEAL_EMOJI[m.type]))].join(' ');

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* Row header */}
      <button
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${entry.hasOvernight ? 'bg-blue-400' : 'bg-green-400'}`} />
        <span className="text-sm font-semibold text-foreground flex-1">{dutyDateLabel(entry.date)}</span>
        <span className="text-base mr-1">{mealIcons}</span>
        <span className="text-sm font-bold text-foreground">{fmtBRL(entry.total)}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {/* Expanded meal list */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/50 divide-y divide-border/30">
              {entry.meals.map((meal, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{MEAL_LABEL[meal.type]}</p>
                    <p className="text-xs text-muted-foreground">{meal.activityLabel}</p>
                  </div>
                  <span className="text-sm font-bold text-foreground">{fmtBRL(meal.value)}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    meal.isNational
                      ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                      : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                  }`}>
                    {meal.isNational ? 'NAC' : 'INT'}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PerDiemPage() {
  const { schedule, loading: schedLoading } = useScheduleData();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear] = useState(new Date().getFullYear());
  const [showRates, setShowRates] = useState(false);
  const [ratesVersion, setRatesVersion] = useState(0);

  // Force re-render when rates are saved
  if (typeof window !== 'undefined') {
    window.addEventListener('perdiem-rates-updated', () => setRatesVersion(v => v + 1), { once: true });
  }

  const rates = useMemo(() => loadRates(), [ratesVersion]);

  const allDuties = useMemo(() => groupIntoDutyPeriods(schedule), [schedule]);

  const monthDuties = useMemo(() => {
    const prefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    return allDuties.filter(d => d.dutyStartDate.startsWith(prefix));
  }, [allDuties, selectedMonth, selectedYear]);

  const perDiemEntries = useMemo(() =>
    monthDuties
      .map(d => computeDutyPerDiem(d, rates))
      .filter((x): x is ComputedDutyPerDiem => x !== null)
      .sort((a, b) => a.date.localeCompare(b.date)),
    [monthDuties, rates]
  );

  const totalMonth = useMemo(() => perDiemEntries.reduce((s, e) => s + e.total, 0), [perDiemEntries]);

  const workDays = useMemo(() => new Set(perDiemEntries.map(e => e.date)).size, [perDiemEntries]);
  const overnights = useMemo(() => perDiemEntries.filter(e => e.hasOvernight).length, [perDiemEntries]);

  // Meal breakdown totals
  const mealBreakdown = useMemo(() => {
    const map: Record<string, { count: number; value: number; total: number; isNational: boolean }> = {};
    for (const entry of perDiemEntries) {
      for (const meal of entry.meals) {
        const key = meal.type;
        if (!map[key]) map[key] = { count: 0, value: meal.value, total: 0, isNational: meal.isNational };
        map[key].count += 1;
        map[key].total += meal.value;
      }
    }
    return map;
  }, [perDiemEntries]);

  const hasSchedule = schedule.length > 0;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Month selector + rates button */}
        <div className="flex items-center gap-2">
          <div className="glass flex-1 px-3 py-2 flex items-center justify-between gap-2">
            <button
              onClick={() => setSelectedMonth(m => Math.max(0, m - 1))}
              className="p-1 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-foreground">{MONTHS[selectedMonth]} {selectedYear}</span>
            <button
              onClick={() => setSelectedMonth(m => Math.min(11, m + 1))}
              className="p-1 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowRates(true)}
            className="glass p-2.5 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>

        {/* Total card */}
        <div className="glass rounded-2xl p-5 text-center space-y-1">
          <p className="text-sm text-muted-foreground font-medium">Total de Diárias</p>
          <p className="text-4xl font-extrabold text-foreground tracking-tight">
            {fmtBRL(totalMonth)}
          </p>
          <div className="flex justify-center gap-8 pt-2">
            <div>
              <p className="text-2xl font-bold text-foreground">{workDays}</p>
              <p className="text-xs text-muted-foreground">Dias trabalhados</p>
            </div>
            <div className="w-px bg-border" />
            <div>
              <p className="text-2xl font-bold text-foreground">{overnights}</p>
              <p className="text-xs text-muted-foreground">Pernoites fora</p>
            </div>
          </div>
        </div>

        {/* No schedule imported */}
        {!schedLoading && !hasSchedule && (
          <div className="glass rounded-2xl p-5 text-center space-y-2">
            <p className="text-sm font-semibold text-foreground">Escala não importada</p>
            <p className="text-xs text-muted-foreground">
              Importe sua escala para calcular diárias automaticamente
            </p>
            <Link
              to="/minha-escala"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline mt-1"
            >
              <CalendarClock className="w-3.5 h-3.5" />
              Ir para Minha Escala
            </Link>
          </div>
        )}

        {/* Detalhamento */}
        {Object.keys(mealBreakdown).length > 0 && (
          <div className="glass rounded-2xl p-4 space-y-3">
            <p className="text-sm font-bold text-foreground">Detalhamento</p>
            <div className="space-y-0">
              {/* Group by national/international */}
              {(['Nacional', 'Internacional'] as const).map(group => {
                const isNat = group === 'Nacional';
                const rows = Object.entries(mealBreakdown).filter(([, v]) => v.isNational === isNat);
                if (rows.length === 0) return null;
                return (
                  <div key={group} className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground pt-1">{group}</p>
                    {rows.map(([type, stats]) => (
                      <div key={type} className="flex items-center justify-between text-sm py-0.5">
                        <span className="text-foreground">
                          {stats.count} {MEAL_LABEL[type as keyof typeof MEAL_LABEL]}{stats.count !== 1 ? 's' : ''}
                        </span>
                        <span className="text-muted-foreground font-mono text-xs">
                          {stats.count} × {fmtBRL(stats.value)} = <strong className="text-foreground">{fmtBRL(stats.total)}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Detalhes por dia */}
        {perDiemEntries.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-bold text-foreground px-0.5">Detalhes por dia</p>
            {perDiemEntries.map(entry => (
              <DutyPerDiemCard key={entry.dutyId} entry={entry} />
            ))}
          </div>
        )}

        {/* Empty state for month with schedule but no per diem */}
        {!schedLoading && hasSchedule && perDiemEntries.length === 0 && (
          <div className="text-center py-10">
            <p className="text-2xl mb-2">🍽️</p>
            <p className="text-sm font-medium text-foreground">Sem diárias em {MONTHS[selectedMonth]}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Nenhuma jornada com apresentação encontrada neste mês
            </p>
          </div>
        )}

        {/* Rates config note */}
        <div className="flex items-center justify-center gap-1.5 pb-2">
          <Settings2 className="w-3 h-3 text-muted-foreground/60" />
          <button
            onClick={() => setShowRates(true)}
            className="text-xs text-muted-foreground/70 hover:text-primary transition-colors"
          >
            Configurar valores por refeição
          </button>
        </div>
      </div>

      {/* Rates bottom sheet */}
      <AnimatePresence>
        {showRates && <RatesSheet onClose={() => setShowRates(false)} />}
      </AnimatePresence>
    </AppLayout>
  );
}
