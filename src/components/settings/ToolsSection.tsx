/** Ferramentas que saíram do Início: calculadoras e METAR/TAF, agrupadas em Ajustes. */
import { Link } from 'react-router-dom';
import { BedDouble, Clock, CloudSun, Shield } from 'lucide-react';
import { AppCard, FeatureRow } from '@/components/ui/primitives';

const TOOLS = [
  { to: '/duty-calc', label: 'Calcular jornada', desc: 'Cálculo operacional', icon: Clock },
  { to: '/rest-calc', label: 'Calcular descanso', desc: 'Repouso operacional', icon: BedDouble },
  { to: '/regulation', label: 'Calculadora operacional', desc: 'Situação e limites (RBAC 117)', icon: Shield },
  { to: '/weather', label: 'METAR/TAF', desc: 'Tempo nos aeroportos', icon: CloudSun },
];

export function ToolsSection() {
  return (
    <AppCard>
      <div className="divide-y divide-border/60">
        {TOOLS.map(({ to, label, desc, icon }) => (
          <Link key={to} to={to}>
            <FeatureRow icon={icon} iconBg="bg-primary/8" iconColor="text-primary" title={label} description={desc} className="rounded-none border-0 shadow-none" />
          </Link>
        ))}
      </div>
    </AppCard>
  );
}
