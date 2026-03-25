import { Link } from 'react-router-dom';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

export const APP_VERSION = '1.0.0';

export function LegalFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        'mt-10 pt-8 border-t border-border text-center shrink-0',
        className,
      )}
    >
      <p className="text-xs text-muted-foreground">© 2026 EscalaX</p>
      <p className="text-xs text-muted-foreground mt-0.5">Todos os direitos reservados</p>
    </footer>
  );
}

interface LegalDocumentProps {
  title: string;
  /** Texto curto na barra superior */
  shortTitle?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  /** Links adicionais acima do footer padrão */
  navLinks?: { label: string; to: string }[];
}

/**
 * Layout para documentos legais e páginas institucionais: largura máx. 900px, tipografia legível, scroll vertical.
 */
export function LegalDocument({
  title,
  shortTitle,
  icon: Icon,
  children,
  navLinks,
}: LegalDocumentProps) {
  const { session } = useAuth();
  const backTo = session ? '/settings' : '/';

  return (
    <div className="min-h-screen min-h-dvh bg-background flex flex-col">
      <header className="sticky top-0 z-40 shrink-0 gradient-dark px-4 py-3 flex items-center gap-3 safe-area-top">
        <Link
          to={backTo}
          className="text-primary-foreground p-1.5 -m-1 hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        {Icon && <Icon className="w-5 h-5 text-primary-foreground shrink-0" aria-hidden />}
        <span className="text-sm font-semibold text-primary-foreground truncate">
          {shortTitle ?? title}
        </span>
      </header>

      <main className="flex-1 w-full max-w-[900px] mx-auto px-4 sm:px-6 py-8 pb-12 min-w-0 overflow-y-auto">
        <article className="prose prose-sm sm:prose-base dark:prose-invert max-w-none text-foreground prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-1 not-prose">{title}</h1>
          <div className="not-prose">{children}</div>
        </article>

        {navLinks && navLinks.length > 0 && (
          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-10 pt-6 border-t border-border not-prose">
            {navLinks.map((l) => (
              <Link key={l.to} to={l.to} className="text-xs text-primary hover:underline">
                {l.label}
              </Link>
            ))}
          </nav>
        )}

        <LegalFooter />
      </main>
    </div>
  );
}
