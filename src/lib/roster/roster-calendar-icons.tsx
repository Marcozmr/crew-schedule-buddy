/**
 * Ícones do calendário da escala — mapeamento visual por tipo (Lucide, tom profissional).
 */

import type { ReactNode } from 'react';
import {
  PlaneTakeoff,
  Sparkles,
  Moon,
  Clock,
  GraduationCap,
  Headphones,
  ScrollText,
  ShieldCheck,
  Stethoscope,
  Building2,
  UserCheck,
  CircleDot,
  MonitorPlay,
} from 'lucide-react';
import type { ScheduleEntry } from '@/hooks/useScheduleData';
import { getRosterEventVisualType, type RosterCalendarVisualType } from '@/lib/roster/roster-calendar-visual';

export type { RosterCalendarVisualType };

const dim = (size: 'sm' | 'md') => (size === 'sm' ? 'h-3 w-3' : 'h-4 w-4');

function iconClass(size: 'sm' | 'md', tone: string) {
  return `${dim(size)} shrink-0 ${tone}`;
}

function iconForType(
  t: RosterCalendarVisualType,
  size: 'sm' | 'md',
): ReactNode {
  switch (t) {
    case 'flight':
      return <PlaneTakeoff className={iconClass(size, 'text-primary')} />;
    case 'extra':
      return <Sparkles className={iconClass(size, 'text-amber-600 dark:text-amber-400')} />;
    case 'rest':
      return <Moon className={iconClass(size, 'text-emerald-600 dark:text-emerald-400')} />;
    case 'standby':
      return <Clock className={iconClass(size, 'text-amber-700 dark:text-amber-400')} />;
    case 'course':
      return <GraduationCap className={iconClass(size, 'text-sky-600 dark:text-sky-400')} />;
    case 'simulator':
      return <MonitorPlay className={iconClass(size, 'text-violet-600 dark:text-violet-400')} />;
    case 'crm':
      return <Headphones className={iconClass(size, 'text-slate-600 dark:text-slate-300')} />;
    case 'cma':
      return <ScrollText className={iconClass(size, 'text-slate-600 dark:text-slate-300')} />;
    case 'lgpd':
      return <ShieldCheck className={iconClass(size, 'text-primary')} />;
    case 'medical':
      return <Stethoscope className={iconClass(size, 'text-rose-600 dark:text-rose-400')} />;
    case 'hotel':
      return <Building2 className={iconClass(size, 'text-muted-foreground')} />;
    case 'presentation':
      return <UserCheck className={iconClass(size, 'text-primary')} />;
    case 'generic':
    default:
      return <CircleDot className={iconClass(size, 'text-muted-foreground')} />;
  }
}

/** Fundo do quadrado de ícone no painel lateral (Sheet). */
/** Faixa compacta no dia do calendário (grade mensal). */
export function getRosterCalendarCellPillClass(entry: ScheduleEntry): string {
  const t = getRosterEventVisualType(entry);
  switch (t) {
    case 'flight':
      return 'bg-blue-500/20 text-blue-700 dark:text-blue-300 font-semibold';
    case 'rest':
      return 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-medium';
    case 'extra':
      return 'bg-amber-500/20 text-amber-800 dark:text-amber-300 font-medium';
    case 'standby':
      return 'bg-orange-500/20 text-orange-700 dark:text-orange-300';
    case 'course':
    case 'simulator':
      return 'bg-sky-500/20 text-sky-700 dark:text-sky-300';
    case 'crm':
    case 'cma':
      return 'bg-slate-400/20 text-slate-700 dark:text-slate-300';
    case 'lgpd':
      return 'bg-blue-400/15 text-blue-700 dark:text-blue-300';
    case 'medical':
      return 'bg-rose-500/20 text-rose-700 dark:text-rose-300';
    case 'hotel':
      return 'bg-violet-400/15 text-violet-700 dark:text-violet-300';
    case 'presentation':
      return 'bg-blue-500/20 text-blue-700 dark:text-blue-300';
    case 'generic':
    default:
      return 'bg-slate-400/15 text-slate-600 dark:text-slate-400';
  }
}

export function getRosterCalendarContainerClass(entry: ScheduleEntry): string {
  const t = getRosterEventVisualType(entry);
  switch (t) {
    case 'flight':
      return 'bg-primary/10';
    case 'extra':
      return 'bg-amber-500/10 dark:bg-amber-400/10';
    case 'rest':
      return 'bg-success/10';
    case 'standby':
      return 'bg-warning/10';
    case 'course':
    case 'simulator':
      return 'bg-sky-500/10 dark:bg-sky-400/10';
    case 'crm':
    case 'cma':
      return 'bg-secondary';
    case 'lgpd':
      return 'bg-primary/8';
    case 'medical':
      return 'bg-rose-500/10';
    case 'hotel':
      return 'bg-secondary';
    case 'presentation':
      return 'bg-primary/10';
    case 'generic':
    default:
      return 'bg-secondary';
  }
}

export interface RosterCalendarEventIconProps {
  entry: ScheduleEntry;
  size?: 'sm' | 'md';
}

export function RosterCalendarEventIcon({ entry, size = 'md' }: RosterCalendarEventIconProps) {
  const t = getRosterEventVisualType(entry);
  return iconForType(t, size);
}
