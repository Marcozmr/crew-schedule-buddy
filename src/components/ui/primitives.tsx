/**
 * Primitivos visuais do EscalaX.
 * Wrappers sobre shadcn/ui + Tailwind que aplicam o design system de forma consistente.
 * Use esses componentes em vez de divs/classes customizadas espalhadas pelo código.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, ChevronRight } from "lucide-react";

// ─── AppCard ────────────────────────────────────────────────────────────────
// Card branco padrão do app (substitui a classe .glass nas páginas).
export const AppCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("glass", className)} {...props} />
));
AppCard.displayName = "AppCard";

// ─── AppCardSection ──────────────────────────────────────────────────────────
// Padding padrão interno do AppCard.
export function AppCardSection({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

// ─── StatCard ────────────────────────────────────────────────────────────────
// Card de estatística: ícone colorido + label + valor + detalhe.
// Usado no Dashboard para "Horas de voo", "Jornada mensal", etc.
interface StatCardProps {
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  label: string;
  value: string;
  detail?: string;
  detailColor?: string;
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  label,
  value,
  detail,
  detailColor,
  className,
  onClick,
}: StatCardProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "glass flex min-w-0 items-center gap-4 px-5 py-4",
        onClick && "cursor-pointer active:scale-[0.98] transition-transform",
        className
      )}
    >
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", iconBg)}>
        <Icon className={cn("h-5 w-5", iconColor)} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-foreground">
          {value}
        </p>
        {detail && (
          <p className={cn("mt-0.5 text-xs", detailColor ?? "text-muted-foreground")}>
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── FeatureRow ───────────────────────────────────────────────────────────────
// Linha de funcionalidade: ícone colorido + título + descrição + badge opcional.
// Usado em Conexões, listas de recursos, etc.
interface FeatureRowProps {
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  title: string;
  description?: string;
  badge?: string;
  className?: string;
  onClick?: () => void;
  href?: string;
}

export function FeatureRow({
  icon: Icon,
  iconBg = "bg-primary/10",
  iconColor = "text-primary",
  title,
  description,
  badge,
  className,
  onClick,
  href,
}: FeatureRowProps) {
  const inner = (
    <>
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", iconBg)}>
        <Icon className={cn("h-5 w-5", iconColor)} strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {badge && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {(onClick || href) && (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
      )}
    </>
  );

  const baseClass = cn(
    "glass flex items-center gap-4 px-5 py-4 transition-colors",
    (onClick || href) && "cursor-pointer hover:bg-secondary/30 active:bg-secondary/50",
    className
  );

  if (href) {
    return <a href={href} className={baseClass}>{inner}</a>;
  }

  return (
    <div role={onClick ? "button" : undefined} onClick={onClick} className={baseClass}>
      {inner}
    </div>
  );
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────
// Label de seção em uppercase com tracking-wide. Padrão visual do app.
interface SectionLabelProps {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function SectionLabel({ children, action, className }: SectionLabelProps) {
  return (
    <div className={cn("flex items-center justify-between px-1 mb-3", className)}>
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {children}
      </p>
      {action}
    </div>
  );
}

// ─── PageHeader ───────────────────────────────────────────────────────────────
// Cabeçalho de página: saudação + subtítulo. Usado no Dashboard.
interface PageHeaderProps {
  greeting: string;
  name: string;
  subtitle?: string;
  className?: string;
}

export function PageHeader({ greeting, name, subtitle, className }: PageHeaderProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <h1 className="break-words text-2xl font-bold tracking-tight text-foreground">
        {greeting},{" "}
        <span className="text-primary">{name}</span>
      </h1>
      {subtitle && (
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
// Estado vazio padrão: ícone + título + descrição + ação opcional.
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("glass flex flex-col items-center px-6 py-10 text-center", className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60">
        <Icon className="h-7 w-7 text-muted-foreground/50" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ─── InfoRow ─────────────────────────────────────────────────────────────────
// Par label/valor em linha. Usado em cards de detalhes.
interface InfoRowProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  className?: string;
}

export function InfoRow({ label, value, mono, className }: InfoRowProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-2.5", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-xs font-semibold text-foreground", mono && "font-mono tabular-nums")}>
        {value}
      </span>
    </div>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────
// Separador visual com label opcional no centro.
export function Divider({ label, className }: { label?: string; className?: string }) {
  if (!label) {
    return <div className={cn("h-px bg-border/60", className)} />;
  }
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="h-px flex-1 bg-border/60" />
      <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
        {label}
      </span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}
