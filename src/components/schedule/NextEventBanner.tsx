import type { DutyPeriod } from '@/lib/duty-grouping';
import { formatCountdown } from './countdown';

interface Props {
  nextDuty: DutyPeriod | null;
  now: Date;
}

/** Brasil sem horário de verão desde 2019: a escala usa horário de Brasília (UTC−3). */
function startOf(duty: DutyPeriod): Date | null {
  const time = duty.reportTime || duty.dutyStartTime;
  if (!duty.dutyStartDate || !time) return null;
  const d = new Date(`${duty.dutyStartDate}T${time.slice(0, 5)}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function NextEventBanner({ nextDuty, now }: Props) {
  if (!nextDuty) return null;
  const start = startOf(nextDuty);
  const time = (nextDuty.reportTime || nextDuty.dutyStartTime || '').slice(0, 5);
  const firstLeg = nextDuty.legs[0];
  const place = firstLeg?.departure?.trim().toUpperCase().slice(0, 3);
  const title = nextDuty.reportTime ? 'Apresentação' : nextDuty.routeSummary;

  return (
    <div className="flex items-center justify-between gap-3 rounded-[22px] bg-primary px-[18px] py-4 text-primary-foreground shadow-[0_10px_24px_hsl(var(--primary)/0.28)]">
      <div className="min-w-0">
        <p className="text-[11px] font-bold tracking-[0.08em]">PRÓXIMO EVENTO</p>
        <p className="truncate text-[19px] font-extrabold leading-tight">{title}</p>
        <p className="text-[13px] font-medium">{[place, time].filter(Boolean).join(' · ')}</p>
      </div>
      {start && (
        <span className="shrink-0 rounded-full bg-accent px-3.5 py-2 text-[15px] font-extrabold text-accent-foreground">
          {formatCountdown(start.getTime() - now.getTime())}
        </span>
      )}
    </div>
  );
}
