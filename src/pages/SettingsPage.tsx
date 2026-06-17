import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppCard, AppCardSection, SectionLabel, FeatureRow, Divider } from '@/components/ui/primitives';
import { toast } from 'sonner';
import { Save, LogOut, FileText, HelpCircle, Info, Scale, Shield, Bell } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { APP_VERSION } from '@/components/legal/LegalDocument';
import { motion } from 'framer-motion';
import { RosterSourcesCard } from '@/components/roster/RosterSourcesCard';
import { dispatchOperationalPreferencesChanged } from '@/lib/events/operational-preferences-events';
import { applyResolvedThemePreference, normalizeThemePreference } from '@/lib/themeByTime';
import { getTimezoneLabel, isKnownOperationalTimezone, OPERATIONAL_TIMEZONE_OPTIONS } from '@/lib/timezone-options';

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.3, ease: 'easeOut' as const },
});

export default function SettingsPage() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const [form, setForm] = useState({
    name: '', base_airport: '', crew_role: '', company_name: '',
    timezone: 'America/Sao_Paulo', notifications_enabled: true, theme: 'auto',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (data) {
        const th = normalizeThemePreference(data.theme);
        setForm({
          name: profile?.name || '',
          base_airport: data.base_airport || '',
          crew_role: data.crew_role || '',
          company_name: data.company_name || '',
          timezone: data.timezone || 'America/Sao_Paulo',
          notifications_enabled: data.notifications_enabled ?? true,
          theme: th,
        });
        applyResolvedThemePreference(th, data.timezone, setTheme);
      } else {
        setForm(c => ({ ...c, name: profile?.name || '', company_name: profile?.airline || '' }));
      }
    });
  }, [user, profile, setTheme]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const baseTrim = form.base_airport.trim();
    const { error } = await supabase.from('user_settings').upsert({
      user_id: user.id,
      base_airport: baseTrim || null,
      home_base_user_locked: baseTrim.length > 0,
      home_base_source: baseTrim.length > 0 ? 'manual' : null,
      crew_role: form.crew_role,
      company_name: form.company_name,
      timezone: form.timezone,
      notifications_enabled: form.notifications_enabled,
      theme: form.theme,
    }, { onConflict: 'user_id' });

    if (form.name || form.company_name) {
      await supabase.from('profiles').update({ name: form.name, airline: form.company_name }).eq('user_id', user.id);
    }
    if (error) toast.error(error.message);
    else { toast.success('Ajustes salvos!'); dispatchOperationalPreferencesChanged(); }
    setSaving(false);
  };

  const handleLogout = async () => { await signOut(); navigate('/'); };

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-5 pb-10 min-w-0">

        {/* Escala */}
        <motion.div {...fade(0)}>
          <SectionLabel>Minha escala</SectionLabel>
          <RosterSourcesCard />
        </motion.div>

        {/* Perfil */}
        <motion.div {...fade(0.06)}>
          <SectionLabel>Perfil</SectionLabel>
          <AppCard>
            <AppCardSection className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nome</Label>
                <Input value={form.name} onChange={e => setForm(c => ({ ...c, name: e.target.value }))} className="h-11" />
              </div>
              <Divider />
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Minha base</Label>
                <Input value={form.base_airport} onChange={e => setForm(c => ({ ...c, base_airport: e.target.value }))} placeholder="BSB" className="h-11" />
              </div>
              <Divider />
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Função</Label>
                <Input value={form.crew_role} onChange={e => setForm(c => ({ ...c, crew_role: e.target.value }))} placeholder="Comandante, Copiloto, Comissário..." className="h-11" />
              </div>
              <Divider />
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Empresa</Label>
                <Input value={form.company_name} onChange={e => setForm(c => ({ ...c, company_name: e.target.value }))} placeholder="Operador" className="h-11" />
              </div>
            </AppCardSection>
          </AppCard>
        </motion.div>

        {/* Preferências */}
        <motion.div {...fade(0.1)}>
          <SectionLabel>Preferências</SectionLabel>
          <AppCard>
            <AppCardSection className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fuso horário</Label>
                <Select
                  value={form.timezone}
                  onValueChange={value => {
                    setForm(c => {
                      const next = { ...c, timezone: value };
                      if (next.theme === 'auto') queueMicrotask(() => applyResolvedThemePreference('auto', next.timezone, setTheme));
                      return next;
                    });
                  }}
                >
                  <SelectTrigger className="h-11 w-full"><SelectValue placeholder="Fuso horário" /></SelectTrigger>
                  <SelectContent>
                    {OPERATIONAL_TIMEZONE_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                    {form.timezone.trim() !== '' && !isKnownOperationalTimezone(form.timezone) && (
                      <SelectItem value={form.timezone}>{getTimezoneLabel(form.timezone)}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Divider />
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tema</Label>
                <Select
                  value={form.theme}
                  onValueChange={value => {
                    setForm(c => {
                      const next = { ...c, theme: value as 'auto' | 'light' | 'dark' };
                      queueMicrotask(() => applyResolvedThemePreference(normalizeThemePreference(next.theme), next.timezone, setTheme));
                      return next;
                    });
                  }}
                >
                  <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automático (horário)</SelectItem>
                    <SelectItem value="light">Claro</SelectItem>
                    <SelectItem value="dark">Escuro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Divider />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium text-foreground cursor-pointer">Notificações</Label>
                </div>
                <Switch
                  checked={form.notifications_enabled}
                  onCheckedChange={value => setForm(c => ({ ...c, notifications_enabled: value }))}
                />
              </div>
            </AppCardSection>
          </AppCard>
        </motion.div>

        {/* Sistema */}
        <motion.div {...fade(0.14)}>
          <SectionLabel>Sistema</SectionLabel>
          <AppCard>
            <div className="divide-y divide-border/60">
              {[
                { to: '/about', label: 'Sobre EscalaX', icon: Info },
                { to: '/legal/terms', label: 'Termos de Uso', icon: FileText },
                { to: '/legal/privacy', label: 'Política de Privacidade', icon: Shield },
                { to: '/legal/lgpd', label: 'Política LGPD', icon: Scale },
                { to: '/support', label: 'Suporte', icon: HelpCircle },
              ].map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to}>
                  <FeatureRow
                    icon={Icon}
                    iconBg="bg-primary/8"
                    iconColor="text-primary"
                    title={label}
                    onClick={undefined}
                    href={undefined}
                    className="rounded-none border-0 shadow-none"
                  />
                </Link>
              ))}
              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-sm text-muted-foreground">Versão do app</span>
                <span className="text-sm font-semibold text-foreground tabular-nums">{APP_VERSION}</span>
              </div>
            </div>
          </AppCard>
        </motion.div>

        {/* Ações */}
        <motion.div {...fade(0.18)} className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={handleSave} disabled={saving} className="w-full sm:flex-1 h-12 font-semibold">
            <Save className="w-4 h-4 mr-2 shrink-0" />
            {saving ? 'Salvando...' : 'Salvar configurações'}
          </Button>
          <Button variant="outline" onClick={handleLogout} className="w-full sm:w-auto h-12 text-destructive border-destructive/30 hover:bg-destructive/8">
            <LogOut className="w-4 h-4 mr-2 shrink-0" /> Sair da conta
          </Button>
        </motion.div>

      </div>
    </AppLayout>
  );
}
