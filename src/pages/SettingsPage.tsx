import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Settings, Save, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function SettingsPage() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', base_airport: '', crew_role: '', company_name: '', timezone: 'America/Sao_Paulo',
    notifications_enabled: true, theme: 'system',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setForm({
          name: profile?.name || '',
          base_airport: data.base_airport || '',
          crew_role: data.crew_role || '',
          company_name: data.company_name || '',
          timezone: data.timezone || 'America/Sao_Paulo',
          notifications_enabled: data.notifications_enabled ?? true,
          theme: data.theme || 'system',
        });
      } else {
        setForm(f => ({ ...f, name: profile?.name || '', company_name: profile?.airline || '' }));
      }
    });
  }, [user, profile]);

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
      <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
        <Settings className="w-6 h-6 text-primary" />Configurações
      </motion.h1>
      <div className="max-w-lg space-y-6">
        <div className="bg-card rounded-xl p-6 shadow-card border border-border">
          <h3 className="font-semibold text-foreground mb-4">Perfil</h3>
          <div className="space-y-3">
            <div><Label className="text-xs">Nome</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label className="text-xs">Base</Label><Input value={form.base_airport} onChange={e => setForm(f => ({ ...f, base_airport: e.target.value }))} placeholder="BSB" /></div>
            <div><Label className="text-xs">Função</Label><Input value={form.crew_role} onChange={e => setForm(f => ({ ...f, crew_role: e.target.value }))} placeholder="Comandante, Copiloto, Comissário..." /></div>
            <div><Label className="text-xs">Empresa</Label><Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} placeholder="LATAM" /></div>
          </div>
        </div>
        <div className="bg-card rounded-xl p-6 shadow-card border border-border">
          <h3 className="font-semibold text-foreground mb-4">Preferências</h3>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Fuso horário</Label>
              <Select value={form.timezone} onValueChange={v => setForm(f => ({ ...f, timezone: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/Sao_Paulo">America/Sao_Paulo (BRT)</SelectItem>
                  <SelectItem value="America/Manaus">America/Manaus (AMT)</SelectItem>
                  <SelectItem value="America/Belem">America/Belem (BRT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tema</Label>
              <Select value={form.theme} onValueChange={v => setForm(f => ({ ...f, theme: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">Sistema</SelectItem>
                  <SelectItem value="light">Claro</SelectItem>
                  <SelectItem value="dark">Escuro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Notificações</Label>
              <Switch checked={form.notifications_enabled} onCheckedChange={v => setForm(f => ({ ...f, notifications_enabled: v }))} />
            </div>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full"><Save className="w-4 h-4 mr-2" />{saving ? 'Salvando...' : 'Salvar configurações'}</Button>
        <div className="pt-4 border-t border-border">
          <Button variant="outline" className="w-full text-destructive" onClick={handleLogout}><LogOut className="w-4 h-4 mr-2" />Sair da conta</Button>
        </div>
      </div>
    </AppLayout>
  );
}
