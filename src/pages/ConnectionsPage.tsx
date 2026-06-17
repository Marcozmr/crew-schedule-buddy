import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { motion } from 'framer-motion';
import { Users, Calendar, Share2, MapPin, Bell, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppCard, AppCardSection, FeatureRow, SectionLabel, EmptyState } from '@/components/ui/primitives';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';

const FEATURES = [
  {
    icon: Users,
    title: 'Conecte com tripulantes',
    desc: 'Encontre colegas de outras bases ou companhias e veja quando suas escalas coincidem.',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    soon: false,
  },
  {
    icon: Calendar,
    title: 'Compare folgas',
    desc: 'Descubra quem tem os mesmos dias de folga para planejar atividades juntos.',
    iconBg: 'bg-green-500/10',
    iconColor: 'text-green-500',
    soon: false,
  },
  {
    icon: MapPin,
    title: 'Pernoites em comum',
    desc: 'Saiba quais colegas estarão na mesma cidade durante layovers.',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    soon: false,
  },
  {
    icon: Share2,
    title: 'Compartilhar escala',
    desc: 'Compartilhe sua escala com familiares e amigos para acompanharem sua rotina.',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
    soon: false,
  },
  {
    icon: Bell,
    title: 'Alertas de coincidência',
    desc: 'Receba notificações quando um colega estiver na mesma rota ou cidade.',
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-500',
    soon: true,
  },
];

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.3, ease: 'easeOut' as const },
});

export default function ConnectionsPage() {
  const { profile, user } = useAuth();
  const [copied, setCopied] = useState(false);

  const shareUrl = user ? `${window.location.origin}/share/${user.id}` : '';

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareNative = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      await navigator.share({
        title: 'Minha escala — EscalaX',
        text: 'Acompanhe minha escala de voos no EscalaX',
        url: shareUrl,
      });
    } else {
      await copyLink();
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Hero */}
        <motion.div {...fade(0)}>
          <AppCard className="relative overflow-hidden">
            <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-primary/8 blur-2xl" />
            <AppCardSection className="relative flex flex-col items-center py-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15">
                <Users className="h-8 w-8 text-primary" strokeWidth={1.75} />
              </div>
              <h1 className="text-xl font-bold text-foreground">Conexões</h1>
              <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
                Conecte-se com colegas de tripulação e compartilhe sua rotina com quem importa.
              </p>
            </AppCardSection>
          </AppCard>
        </motion.div>

        {/* Compartilhar escala */}
        <motion.div {...fade(0.07)}>
          <AppCard>
            <AppCardSection>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                  <Share2 className="h-5 w-5 text-blue-500" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Compartilhar sua escala</p>
                  <p className="text-xs text-muted-foreground">Permita que familiares acompanhem seus voos</p>
                </div>
              </div>

              {profile && (
                <div className="mb-4 flex items-center gap-3 rounded-xl bg-secondary/60 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
                    <span className="text-sm font-bold text-primary">
                      {(profile.name || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{profile.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{profile.airline || 'Tripulante'}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={() => void shareNative()} className="flex-1 gap-2" size="sm">
                  <Share2 className="h-4 w-4" />
                  Compartilhar
                </Button>
                <Button onClick={() => void copyLink()} variant="outline" size="sm" className="gap-2">
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copiado' : 'Copiar link'}
                </Button>
              </div>
            </AppCardSection>
          </AppCard>
        </motion.div>

        {/* Features */}
        <motion.div {...fade(0.12)}>
          <SectionLabel>O que você pode fazer</SectionLabel>
          <div className="space-y-2.5">
            {FEATURES.map((f, i) => (
              <motion.div key={i} {...fade(0.14 + i * 0.04)}>
                <FeatureRow
                  icon={f.icon}
                  iconBg={f.iconBg}
                  iconColor={f.iconColor}
                  title={f.title}
                  description={f.desc}
                  badge={f.soon ? 'Em breve' : undefined}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Em desenvolvimento */}
        <motion.div {...fade(0.38)}>
          <AppCard>
            <AppCardSection className="text-center py-6">
              <p className="text-sm font-semibold text-foreground">Funcionalidades em desenvolvimento</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground max-w-sm mx-auto">
                A parte social do EscalaX está sendo construída. Em breve você poderá se conectar com outros tripulantes diretamente no app.
              </p>
            </AppCardSection>
          </AppCard>
        </motion.div>

      </div>
    </AppLayout>
  );
}
