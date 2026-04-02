import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Painel branco elevado — apenas apresentação. */
export function SurfacePanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card,1.25rem)] border border-slate-200/90 bg-card shadow-[0_6px_32px_rgba(15,23,42,0.085)] dark:border-border dark:bg-card dark:shadow-lg",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn("space-y-6", className)}>{children}</section>;
}

export function SectionTitle({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-foreground">
        {title}
      </h2>
      {subtitle ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}
