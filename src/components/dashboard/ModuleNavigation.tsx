/**
 * EFB Dashboard — Module Navigation Cards
 * Large glass cards for navigating to feature modules.
 */

import { Calendar, Shield, DollarSign, FolderOpen, Settings, LogOut, Download, ArrowLeftRight, Cloud, Clock, BedDouble, Activity, FileText, Landmark, UtensilsCrossed } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';

interface ModuleItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

interface ModuleGroup {
  title: string;
  description: string;
  icon: React.ElementType;
  accentColor: string;
  glowClass: string;
  items: ModuleItem[];
}

const modules: ModuleGroup[] = [
  {
    title: 'Operações',
    description: 'Escala, voos e meteorologia',
    icon: Calendar,
    accentColor: 'text-primary',
    glowClass: 'shadow-glow-blue',
    items: [
      { label: 'Escala', path: '/schedule', icon: Calendar },
      { label: 'Baixar Escala', path: '/download-roster', icon: Download },
      { label: 'Troca de Voo', path: '/flight-swap', icon: ArrowLeftRight },
      { label: 'Buscar Voos', path: '/search', icon: Cloud },
      { label: 'Clima', path: '/weather', icon: Cloud },
    ],
  },
  {
    title: 'Regulamentação',
    description: 'Jornada, descanso e fadiga',
    icon: Shield,
    accentColor: 'text-success',
    glowClass: 'shadow-glow-green',
    items: [
      { label: 'Cálc. Jornada', path: '/duty-calc', icon: Clock },
      { label: 'Cálc. Descanso', path: '/rest-calc', icon: BedDouble },
      { label: 'Regulamentação', path: '/regulation', icon: FileText },
    ],
  },
  {
    title: 'Financeiro',
    description: 'Salário e diárias',
    icon: DollarSign,
    accentColor: 'text-accent',
    glowClass: '',
    items: [
      { label: 'Salário', path: '/salary', icon: DollarSign },
      { label: 'Diárias', path: '/perdiem', icon: UtensilsCrossed },
    ],
  },
  {
    title: 'Documentos',
    description: 'Certificados e documentos',
    icon: FolderOpen,
    accentColor: 'text-primary',
    glowClass: '',
    items: [
      { label: 'Documentos', path: '/documents', icon: FolderOpen },
    ],
  },
];

export function ModuleNavigation() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Módulos</span>
        <div className="h-px flex-1 bg-border/50" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {modules.map((mod, idx) => (
          <motion.div
            key={mod.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + idx * 0.08 }}
          >
            <div className={`glass rounded-2xl overflow-hidden hover:border-primary/30 transition-all duration-300 group ${mod.glowClass}`}>
              {/* Module header */}
              <div className="p-4 pb-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:scale-105 transition-transform`}>
                    <mod.icon className={`w-5 h-5 ${mod.accentColor}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{mod.title}</h3>
                    <p className="text-[10px] text-muted-foreground">{mod.description}</p>
                  </div>
                </div>
              </div>

              {/* Quick links */}
              <div className="px-4 pb-4 space-y-0.5">
                {mod.items.map(item => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-secondary/60 transition-colors"
                  >
                    <item.icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-secondary-foreground">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* System row */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/settings" className="glass rounded-2xl p-4 flex items-center gap-3 hover:border-primary/30 transition-all">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
            <Settings className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Ajustes</h3>
            <p className="text-[10px] text-muted-foreground">Configurações do app</p>
          </div>
        </Link>
        <button onClick={handleLogout} className="glass rounded-2xl p-4 flex items-center gap-3 hover:border-destructive/30 transition-all text-left w-full">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
            <LogOut className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Sair</h3>
            <p className="text-[10px] text-muted-foreground">Encerrar sessão</p>
          </div>
        </button>
      </div>
    </div>
  );
}
