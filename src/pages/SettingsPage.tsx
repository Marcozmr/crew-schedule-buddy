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
import { toast } from 'sonner';
import { Settings, Save, LogOut, ChevronRight, FileText, HelpCircle, Info, Scale, Shield } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { APP_VERSION } from '@/components/legal/LegalDocument';
import { motion } from 'framer-motion';
import { RosterSourcesCard } from '@/components/roster/RosterSourcesCard';

export default function SettingsPage() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const [form, setForm] = useState({
    name: '', base_airport: '', crew_role: '', company_name: '', timezone: 'America/Sao_Paulo',
    notifications_enabled: true, theme: 'system',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (data) {
        const th = data.theme || 'system';
        setForm({
          name: profile?.name || '',
          base_airport: data.base_airport || '',
          crew_role: data.crew_role || '',
          company_name: data.company_name || '',
          timezone: data.timezone || 'America/Sao_Paulo',
          notifications_enabled: data.notifications_enabled ?? true,
          theme: th,
        });
        if (th === 'light' || th === 'dark' || th === 'system') setTheme(th);
      } else {
        setForm((current) => ({ ...current, name: profile?.name || '', company_name: profile?.airline || '' }));
      }
    });
  }, [user, profile, setTheme]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('user_settings').upsert({
      user_id: user.id,
      base_airport: form.base_airport,
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
    else toast.success('Ajustes salvos!');
    setSaving(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <AppLayout>
      <div className="max-w-4xl space-y-6 pb-10 min-w-0">
        <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold text-foreground flex items-center gap-2 break-words">
          <Settings className="w-6 h-6 text-primary shrink-0" /> Configurações
        </motion.h1>

        <RosterSourcesCard />

        <div className="glass p-5 sm:p-6 min-w-0">
          <h3 className="font-semibold text-foreground mb-1">Sistema</h3>
          <p className="text-xs text-muted-foreground mb-4">Informações legais e suporte</p>
          <div className="divide-y divide-border rounded-xl border border-border/60 overflow-hidden bg-secondary/20">
            {[
              { to: '/about', label: 'Sobre EscalaX', icon: Info },
              { to: '/legal/terms', label: 'Termos de Uso', icon: FileText },
              { to: '/legal/privacy', label: 'Política de Privacidade', icon: Shield },
              { to: '/legal/lgpd', label: 'Política LGPD', icon: Scale },
              { to: '/support', label: 'Suporte', icon: HelpCircle },
            ].map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center justify-between gap-3 px-4 py-3.5 min-h-[48px] hover:bg-secondary/60 active:bg-secondary/80 transition-colors"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 text-primary shrink-0" aria-hidden />
                  <span className="text-sm text-foreground break-words">{label}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
              </Link>
            ))}
            <div className="flex items-center justify-between gap-3 px-4 py-3.5 min-h-[48px]">
              <span className="text-sm text-foreground">Versão do app</span>
              <span className="text-sm text-muted-foreground tabular-nums">{APP_VERSION}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 min-w-0">
          <div className="glass p-5 sm:p-6 min-w-0">
            <h3 className="font-semibold text-foreground mb-4">Perfil</h3>
            <div className="space-y-3 min-w-0">
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs">Nome</Label>
                <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs">Base</Label>
                <Input value={form.base_airport} onChange={(event) => setForm((current) => ({ ...current, base_airport: event.target.value }))} placeholder="BSB" />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs">Função</Label>
                <Input value={form.crew_role} onChange={(event) => setForm((current) => ({ ...current, crew_role: event.target.value }))} placeholder="Comandante, Copiloto, Comissário..." />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs">Empresa</Label>
                <Input value={form.company_name} onChange={(event) => setForm((current) => ({ ...current, company_name: event.target.value }))} placeholder="Operador" />
              </div>
            </div>
          </div>

          <div className="glass p-5 sm:p-6 min-w-0">
            <h3 className="font-semibold text-foreground mb-4">Preferências</h3>
            <div className="space-y-4 min-w-0">
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs">Fuso horário</Label>
                <Select value={form.timezone} onValueChange={(value) => setForm((current) => ({ ...current, timezone: value }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Sao_Paulo">America/Sao_Paulo (BRT)</SelectItem>
                    <SelectItem value="America/Manaus">America/Manaus (AMT)</SelectItem>
                    <SelectItem value="America/Belem">America/Belem (BRT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs">Tema</Label>
                <Select
                  value={form.theme}
                  onValueChange={(value) => {
                    setForm((current) => ({ ...current, theme: value }));
                    setTheme(value);
                  }}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">Sistema</SelectItem>
                    <SelectItem value="light">Claro</SelectItem>
                    <SelectItem value="dark">Escuro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-3 min-w-0">
                <Label className="break-words">Notificações</Label>
                <Switch checked={form.notifications_enabled} onCheckedChange={(value) => setForm((current) => ({ ...current, notifications_enabled: value }))} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row min-w-0">
          <Button onClick={handleSave} disabled={saving} className="w-full sm:flex-1">
            <Save className="w-4 h-4 mr-2 shrink-0" />
            {saving ? 'Salvando...' : 'Salvar configurações'}
          </Button>
          <Button variant="outline" className="w-full sm:w-auto text-destructive" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2 shrink-0" /> Sair da conta
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
