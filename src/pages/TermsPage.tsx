import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 gradient-dark px-4 py-3 flex items-center gap-3">
        <Link to="/" className="text-primary-foreground p-1 hover:bg-white/10 rounded-lg"><ArrowLeft className="w-5 h-5" /></Link>
        <FileText className="w-5 h-5 text-primary-foreground" />
        <span className="text-sm font-bold text-primary-foreground">Termos de Uso</span>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6 text-foreground">
        <h1 className="text-2xl font-bold">Termos de Uso — EscalaX</h1>
        <p className="text-sm text-muted-foreground">Última atualização: Março de 2026</p>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Aceitação dos Termos</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Ao acessar ou utilizar o EscalaX, você concorda com estes Termos de Uso. Se não concordar, não utilize o serviço.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. Descrição do Serviço</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            O EscalaX é uma plataforma de gestão de escalas para tripulantes de aviação, oferecendo importação de rosters, cálculos de jornada e descanso, controle de documentos, troca de voos e notificações operacionais.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. Conta do Usuário</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Você é responsável por manter a confidencialidade das suas credenciais e por todas as atividades realizadas na sua conta. Notifique-nos imediatamente sobre qualquer uso não autorizado.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Uso Aceitável</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">Você concorda em:</p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>Utilizar o serviço apenas para fins legítimos e profissionais</li>
            <li>Não tentar acessar dados de outros usuários</li>
            <li>Não realizar engenharia reversa do sistema</li>
            <li>Não utilizar o serviço para fins ilegais</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Propriedade Intelectual</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Todo o conteúdo, design, código e funcionalidades do EscalaX são de propriedade exclusiva da EscalaX e estão protegidos pelas leis de propriedade intelectual.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Limitação de Responsabilidade</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            O EscalaX é uma ferramenta auxiliar e não substitui sistemas oficiais de controle de jornada da companhia aérea. Os cálculos e informações são fornecidos como referência e não possuem caráter oficial ou vinculante.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">7. Disponibilidade</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Nos esforçamos para manter o serviço disponível 24/7, mas não garantimos disponibilidade ininterrupta. Manutenções programadas serão comunicadas com antecedência quando possível.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">8. Alterações</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Reservamo-nos o direito de alterar estes termos a qualquer momento. Alterações significativas serão comunicadas aos usuários.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">9. Contato</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Dúvidas sobre estes termos podem ser enviadas para: <strong>support@escalax.app.br</strong>
          </p>
        </section>

        <footer className="pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} EscalaX. Todos os direitos reservados.</p>
          <div className="flex justify-center gap-4 mt-2">
            <Link to="/privacy" className="text-xs text-primary hover:underline">Política de Privacidade</Link>
            <Link to="/support" className="text-xs text-primary hover:underline">Suporte</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
