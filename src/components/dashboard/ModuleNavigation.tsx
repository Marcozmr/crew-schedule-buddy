/**
 * EFB Dashboard — Module Navigation
 * Horizontal cards grouped by category. Modules are BELOW operational panels.
 * Visual weight: subtle, secondary to the operational data above.
 */

import { Calendar, Shield, DollarSign, FolderOpen, Settings, LogOut, Download, ArrowLeftRight, Cloud, Clock, BedDouble, FileText, UtensilsCrossed, Search, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
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
  accentVar: string;
  items: ModuleItem[];
}

const modules: ModuleGroup[] = [
  {
    title: 'Operações',
    description: 'Escala, voos e meteorologia',
    icon: Calendar,
    accentVar: 'primary',
    items: [
      { label: 'Escala', path: '/schedule', icon: Calendar },
      { label: 'Baixar Escala', path: '/download-roster', icon: Download },
      { label: 'Troca de Voo', path: '/flight-swap', icon: ArrowLeftRight },
      { label: 'Buscar Voos', path: '/search', icon: Search },
      { label: 'Clima', path: '/weather', icon: Cloud },
    ],
  },
  {
    title: 'Regulamentação',
    description: 'Jornada, descanso e fadiga',
    icon: Shield,
    accentVar: 'success',
    items: [
      { label: 'Cálc. Jornada', path: '/duty-calc', icon: Clock },
      { label: 'Cálc. Descanso', path: '/rest-calc', icon: BedDouble },
      { label: 'Status Regulatório', path: '/regulation', icon: FileText },
    ],
  },
  {
    title: 'Financeiro',
    description: 'Salário e diárias',
    icon: DollarSign,
    accentVar: 'accent',
    items: [
      { label: 'Salário', path: '/salary', icon: DollarSign },
      { label: 'Diárias', path: '/perdiem', icon: UtensilsCrossed },
    ],
  },
  {
    title: 'Documentos',
    description: 'Certificados e documentos',
    icon: FolderOpen,
    accentVar: 'primary',
    items: [
      { label: 'Meus Documentos', path: '/documents', icon: FolderOpen },
    ],
  },
];

export function ModuleNavigation() {
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/';
  };

  return (
    <div className="space-y-3 mt-2">
      {/* Section label */}
      <div className="flex items-center gap-3 px-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Módulos</span>
        <div className="h-px flex-1 bg-border/30" />
      </div>

      {/* Module groups — horizontal full-width cards */}
      {modules.map((mod, idx) => (
        <motion.div
          key={mod.title}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 + idx * 0.06 }}
          className="glass rounded-xl overflow-hidden"
        >
          {/* Module header */}
          <div className="px-4 py-3 flex items-center gap-3 border-b border-border/30">
            <div className={`w-8 h-8 rounded-lg bg-${mod.accentVar}/10 flex items-center justify-center`}>
              <mod.icon className={`w-4 h-4 text-${mod.accentVar}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-foreground leading-tight">{mod.title}</h3>
              <p className="text-[10px] text-muted-foreground">{mod.description}</p>
            </div>
          </div>

          {/* Items as horizontal list */}
          <div className="px-2 py-2 space-y-0.5">
            {mod.items.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/50 transition-colors group"
              >
                <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span className="text-xs font-medium text-secondary-foreground group-hover:text-foreground flex-1">{item.label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </motion.div>
      ))}

      {/* System row */}
      <div className="flex gap-3">
        <Link to="/settings" className="flex-1 glass rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-secondary/30 transition-colors">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-secondary-foreground">Ajustes</span>
        </Link>
        <button onClick={handleLogout} className="flex-1 glass rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-destructive/10 transition-colors text-left">
          <LogOut className="w-4 h-4 text-destructive/70" />
          <span className="text-xs font-medium text-secondary-foreground">Sair</span>
        </button>
      </div>

      {/* Footer */}
      <p className="text-center text-[10px] text-muted-foreground/40 pt-2 pb-4">
        © {new Date().getFullYear()} EscalaX. Desenvolvido por Marcos Vinicius.
      </p>
    </div>
  );
}
