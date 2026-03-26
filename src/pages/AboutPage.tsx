import { Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { APP_VERSION, LegalDocument } from '@/components/legal/LegalDocument';

export default function AboutPage() {
  return (
    <LegalDocument
      title="Sobre o EscalaX"
      shortTitle="Sobre"
      icon={Info}
      navLinks={[
        { label: 'Termos de Uso', to: '/legal/terms' },
        { label: 'Política de Privacidade', to: '/legal/privacy' },
        { label: 'Política LGPD', to: '/legal/lgpd' },
        { label: 'Suporte', to: '/support' },
      ]}
    >
      <p className="text-sm text-muted-foreground mt-2">Informações do aplicativo</p>

      <div className="mt-8 space-y-6">
        <div>
          <p className="text-lg font-semibold text-foreground">EscalaX</p>
          <p className="text-sm text-muted-foreground mt-1">
            Versão <span className="text-foreground font-medium tabular-nums">{APP_VERSION}</span>
          </p>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          Aplicativo de organização de escala para tripulantes.
        </p>

        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Suporte</p>
          <a
            href="mailto:support@escalax.app.br"
            className="text-sm text-primary font-medium hover:underline break-all"
          >
            support@escalax.app.br
          </a>
        </div>

        <div
          className="rounded-xl border border-border bg-muted/40 px-4 py-4 space-y-2"
          role="note"
        >
          <p className="text-sm font-semibold text-foreground">Aviso operacional</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            O EscalaX é uma ferramenta de apoio à organização pessoal e à visualização de informações de escala. Não substitui
            sistemas oficiais da companhia aérea, regulamentos aplicáveis nem decisões de comando ou operações. Confirme sempre
            dados críticos nos canais oficiais da sua empresa e na documentação regulatória vigente.
          </p>
        </div>

        <p className="text-xs text-muted-foreground pt-2">
          Dúvidas sobre privacidade e dados pessoais: consulte a{' '}
          <Link to="/legal/privacy" className="text-primary hover:underline">
            Política de Privacidade
          </Link>{' '}
          e a{' '}
          <Link to="/legal/lgpd" className="text-primary hover:underline">
            Política LGPD
          </Link>
          .
        </p>
      </div>
    </LegalDocument>
  );
}
