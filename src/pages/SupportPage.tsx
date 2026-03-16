import { Link } from 'react-router-dom';
import { ArrowLeft, HelpCircle, Mail, MessageCircle } from 'lucide-react';

export default function SupportPage() {
  const copySupportEmail = async () => {
    try {
      await navigator.clipboard.writeText('support@escalax.app.br');
    } catch { /* noop */ }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 gradient-dark px-4 py-3 flex items-center gap-3">
        <Link to="/" className="text-primary-foreground p-1 hover:bg-white/10 rounded-lg"><ArrowLeft className="w-5 h-5" /></Link>
        <HelpCircle className="w-5 h-5 text-primary-foreground" />
        <span className="text-sm font-bold text-primary-foreground">Suporte</span>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8 text-foreground">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Central de Suporte</h1>
          <p className="text-muted-foreground">Estamos aqui para ajudar. Entre em contato com nosso time.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg gradient-sky flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-primary-foreground" />
              </div>
              <h2 className="font-semibold">Chat no App</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Use o botão flutuante no canto inferior direito do app para enviar sua mensagem diretamente.
            </p>
            <p className="text-xs text-muted-foreground">Resposta em até 24h úteis.</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg gradient-sky flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary-foreground" />
              </div>
              <h2 className="font-semibold">E-mail</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Envie um e-mail diretamente para nosso time de suporte.
            </p>
            <button
              onClick={copySupportEmail}
              className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/80 transition-colors"
            >
              support@escalax.app.br
              <span className="text-xs text-muted-foreground">(clique para copiar)</span>
            </button>
          </div>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Perguntas Frequentes</h2>

          <div className="space-y-3">
            {[
              { q: 'Como importar minha escala?', a: 'Acesse o menu "Baixar Escala" e faça upload do seu roster em PDF. O sistema processará automaticamente.' },
              { q: 'Meus dados estão seguros?', a: 'Sim. Utilizamos criptografia em trânsito e em repouso, além de políticas de acesso por usuário.' },
              { q: 'Como funciona o cálculo de descanso?', a: 'Baseado na RBAC 117, o sistema calcula automaticamente os períodos de descanso obrigatórios.' },
              { q: 'Posso usar em mais de um dispositivo?', a: 'Sim. Sua conta sincroniza entre todos os dispositivos.' },
            ].map((item, i) => (
              <details key={i} className="group rounded-lg border border-border bg-card">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">{item.q}</summary>
                <p className="px-4 pb-3 text-sm text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <footer className="pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} EscalaX. Todos os direitos reservados.</p>
          <div className="flex justify-center gap-4 mt-2">
            <Link to="/privacy" className="text-xs text-primary hover:underline">Política de Privacidade</Link>
            <Link to="/terms" className="text-xs text-primary hover:underline">Termos de Uso</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
