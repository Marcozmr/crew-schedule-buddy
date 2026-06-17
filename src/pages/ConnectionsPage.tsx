import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { motion } from 'framer-motion';
import { Users, Calendar, Share2, MapPin, Bell, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';

const FEATURES = [
  {
    icon: Users,
    title: 'Conecte com tripulantes',
    desc: 'Encontre colegas de outras bases ou companhias e veja quando suas escalas coincidem.',
    color: 'bg-primary/10 text-primary',
    soon: false,
  },
  {
    icon: Calendar,
    title: 'Compare folgas',
    desc: 'Descubra quem tem os mesmos dias de folga para planejar atividades juntos.',
    color: 'bg-green-500/10 text-green-400',
    soon: false,
  },
  {
    icon: MapPin,
    title: 'Pernoites em comum',
    desc: 'Saiba quais colegas estarão na mesma cidade durante layovers.',
    color: 'bg-amber-500/10 text-amber-400',
    soon: false,
  },
  {
    icon: Share2,
    title: 'Compartilhar escala',
    desc: 'Compartilhe sua escala com familiares e amigos para acompanharem sua rotina.',
    color: 'bg-blue-500/10 text-blue-400',
    soon: false,
  },
  {
    icon: Bell,
    title: 'Alertas de coincidência',
    desc: 'Receba notificações quando um colega estiver na mesma rota ou cidade.',
    color: 'bg-purple-500/10 text-purple-400',
    soon: true,
  },
];

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
        text: `Acompanhe minha escala de voos no EscalaX`,
        url: shareUrl,
      });
    } else {
      copyLink();
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary/20 via-primary/10 to-card rounded-3xl border border-primary/20 p-6 text-center relative overflow-hidden"
        >
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
          <div className="pointer-events-none absolute -left-12 -bottom-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Conexões</h1>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Aproxime pessoas, compartilhe momentos. Conecte-se com colegas de tripulação e familiares.
            </p>
          </div>
        </motion.div>

        {/* Share schedule card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl border border-border p-5 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Compartilhar sua escala</h3>
              <p className="text-xs text-muted-foreground">Permita que familiares acompanhem seus voos</p>
            </div>
          </div>

          {profile && (
            <div className="flex items-center gap-3 bg-muted/60 rounded-xl p-3">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">
                  {(profile.name || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{profile.name}</p>
                <p className="text-xs text-muted-foreground truncate">{profile.airline || 'Tripulante'}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={shareNative} className="flex-1 gap-2" size="sm">
              <Share2 className="w-4 h-4" />
              Compartilhar
            </Button>
            <Button onClick={copyLink} variant="outline" size="sm" className="gap-2">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado' : 'Copiar link'}
            </Button>
          </div>
        </motion.div>

        {/* Features */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            O que você pode fazer
          </h2>
          {FEATURES.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="bg-card rounded-2xl border border-border p-4 flex items-start gap-4"
            >
              <div className={`w-10 h-10 rounded-xl ${f.color} flex items-center justify-center shrink-0`}>
                <f.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-foreground text-sm">{f.title}</p>
                  {f.soon && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase">
                      Em breve
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Coming soon note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl border border-dashed border-border/60 p-5 text-center space-y-2"
        >
          <p className="text-sm font-medium text-foreground">Funcionalidades em desenvolvimento</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            A parte social do EscalaX está sendo construída. Em breve você poderá se conectar com outros tripulantes diretamente no app.
          </p>
        </motion.div>
      </div>
    </AppLayout>
  );
}
