import { PlaneTakeoff, Clock, Moon, Presentation, GraduationCap, CircleDot } from 'lucide-react';
import type { CrewActivityVisualType } from '@/lib/roster/crew-activity-visual';
import { CabinExtraSeatGlyph } from '@/components/roster/CabinExtraSeatGlyph';
import { cn } from '@/lib/utils';

const GLYPH = 'h-[15px] w-[15px] shrink-0';

const tone = {
  flight: 'text-primary',
  extra_seat: 'text-muted-foreground',
  standby: 'text-amber-600 dark:text-amber-400/90',
  rest: 'text-muted-foreground',
  presentation: 'text-primary',
  course_like: 'text-muted-foreground',
  generic: 'text-muted-foreground/80',
} as const;

export interface CrewActivityGlyphProps {
  type: CrewActivityVisualType;
  className?: string;
}

/**
 * Ícone pequeno por tipo de atividade — Lucide + glifo SVG para “assento/extra”.
 */
export function CrewActivityGlyph({ type, className }: CrewActivityGlyphProps) {
  const c = cn(GLYPH, tone[type], className);
  switch (type) {
    case 'flight':
      return <PlaneTakeoff className={c} strokeWidth={2} aria-hidden />;
    case 'extra_seat':
      return <CabinExtraSeatGlyph className={c} />;
    case 'standby':
      return <Clock className={c} strokeWidth={2} aria-hidden />;
    case 'rest':
      return <Moon className={c} strokeWidth={2} aria-hidden />;
    case 'presentation':
      return <Presentation className={c} strokeWidth={2} aria-hidden />;
    case 'course_like':
      return <GraduationCap className={c} strokeWidth={2} aria-hidden />;
    case 'generic':
    default:
      return <CircleDot className={cn(c, 'opacity-75')} strokeWidth={2} aria-hidden />;
  }
}
