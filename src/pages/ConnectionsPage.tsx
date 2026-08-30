import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { motion } from 'framer-motion';
import { Users, Calendar, Share2, MapPin, Bell, ChevronRight } from 'lucide-react';
import { AppCard, AppCardSection } from '@/components/ui/primitives';

const MENU_ITEMS = [
  {
    to: '/connections/colleagues',
    icon: Users,
    title: 'Conecte com tripulantes',
    desc: 'Encontre colegas com quem você já voou e veja quando suas escalas coincidem.',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
  },
  {
    to: '/connections/days-off',
    icon: Calendar,
    title: 'Compare folgas',
    desc: 'Descubra quem tem os mesmos dias de folga para planejar atividades juntos.',
    iconBg: 'bg-green-500/10',
    iconColor: 'text-green-500',
  },
  {
    to: '/connections/layovers',
    icon: MapPin,
    title: 'Pernoites em comum',
    desc: 'Saiba quais colegas estarão na mesma cidade durante layovers.',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
  },
  {
    to: '/connections/share',
    icon: Share2,
    title: 'Compartilhar escala',
    desc: 'Compartilhe sua escala com familiares e amigos para acompanharem sua rotina.',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
  },
  {
    to: '/connections/alerts',
    icon: Bell,
    title: 'Alertas de coincidência',
    desc: 'Notificações automáticas quando um colega estiver no mesmo voo, folga ou cidade.',
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-500',
  },
];

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.3, ease: 'easeOut' as const },
});

export default function ConnectionsPage() {
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

        {/* Menu */}
        <div className="space-y-2.5">
          {MENU_ITEMS.map((item, i) => (
            <motion.div key={item.to} {...fade(0.05 + i * 0.04)}>
              <Link to={item.to}>
                <AppCard className="hover:bg-secondary/40 transition-colors">
                  <AppCardSection className="flex items-center gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.iconBg}`}>
                      <item.icon className={`h-5 w-5 ${item.iconColor}`} strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </AppCardSection>
                </AppCard>
              </Link>
            </motion.div>
          ))}
        </div>

      </div>
    </AppLayout>
  );
}
