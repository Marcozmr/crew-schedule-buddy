import { useState, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppCard, AppCardSection, SectionLabel, Divider } from '@/components/ui/primitives';
import { Camera, Save, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function ProfilePage() {
  const { profile, user, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: profile?.name || '',
    airline: profile?.airline || '',
    registration: profile?.registration || '',
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;
    await supabase.storage.from('avatars').remove([path]);
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) { toast.error('Erro ao enviar foto'); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('user_id', user.id);
    await refreshProfile();
    toast.success('Foto atualizada!');
    setUploading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      name: form.name, airline: form.airline, registration: form.registration,
    }).eq('user_id', user.id);
    if (error) toast.error('Erro ao salvar');
    else { await refreshProfile(); toast.success('Perfil atualizado!'); }
    setSaving(false);
  };

  const initials = profile?.name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto space-y-4">

        {/* Avatar + nome */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <AppCard>
            <AppCardSection className="flex flex-col items-center py-8">
              <div className="relative group mb-4">
                <Avatar className="w-24 h-24 border-4 border-primary/20">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  {uploading
                    ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                    : <Camera className="w-6 h-6 text-white" />}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </div>
              <p className="text-lg font-bold text-foreground">{profile?.name || '—'}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{profile?.airline || 'Tripulante'}</p>
              <p className="text-xs text-muted-foreground/60 mt-1 flex items-center gap-1">
                <Mail className="w-3 h-3" />{profile?.email}
              </p>
            </AppCardSection>
          </AppCard>
        </motion.div>

        {/* Formulário */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}>
          <SectionLabel>Dados pessoais</SectionLabel>
          <AppCard>
            <AppCardSection className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome completo</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-11" />
              </div>
              <Divider />
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">E-mail</Label>
                <Input value={profile?.email || ''} disabled className="h-11 opacity-50" />
              </div>
              <Divider />
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Companhia aérea</Label>
                <Input placeholder="Ex: LATAM, GOL, Azul" value={form.airline} onChange={e => setForm(f => ({ ...f, airline: e.target.value }))} className="h-11" />
              </div>
              <Divider />
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Matrícula / Registro</Label>
                <Input placeholder="Seu registro" value={form.registration} onChange={e => setForm(f => ({ ...f, registration: e.target.value }))} className="h-11" />
              </div>
            </AppCardSection>
          </AppCard>
        </motion.div>

        <Button onClick={handleSave} disabled={saving} className="w-full h-12 font-semibold text-base">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar alterações
        </Button>

      </div>
    </AppLayout>
  );
}
