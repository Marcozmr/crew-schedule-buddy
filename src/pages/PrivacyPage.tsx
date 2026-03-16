import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 gradient-dark px-4 py-3 flex items-center gap-3">
        <Link to="/" className="text-primary-foreground p-1 hover:bg-white/10 rounded-lg"><ArrowLeft className="w-5 h-5" /></Link>
        <Shield className="w-5 h-5 text-primary-foreground" />
        <span className="text-sm font-bold text-primary-foreground">Política de Privacidade</span>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6 text-foreground">
        <h1 className="text-2xl font-bold">Política de Privacidade — EscalaX</h1>
        <p className="text-sm text-muted-foreground">Última atualização: Março de 2026</p>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Introdução</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            A EscalaX respeita sua privacidade e está comprometida com a proteção dos seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. Dados Coletados</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">Coletamos apenas os dados necessários para o funcionamento do serviço:</p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>Nome e e-mail (para identificação e autenticação)</li>
            <li>Dados de escala e roster importados pelo usuário</li>
            <li>Dados de perfil profissional (companhia aérea, registro)</li>
            <li>Mensagens de suporte enviadas pelo app</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. Finalidade do Tratamento</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">Seus dados são utilizados exclusivamente para:</p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>Gerenciar sua conta e autenticação</li>
            <li>Processar e exibir escalas de voo</li>
            <li>Calcular jornadas, descanso e regulamentações</li>
            <li>Enviar notificações operacionais</li>
            <li>Responder solicitações de suporte</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Compartilhamento</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para fins de marketing. Dados podem ser compartilhados apenas quando exigido por lei ou para operar o serviço (infraestrutura em nuvem).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Segurança</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados, incluindo criptografia em trânsito e em repouso, controle de acesso por usuário e políticas de segurança no nível do banco de dados.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Seus Direitos (LGPD)</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">Você tem direito a:</p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>Acessar seus dados pessoais</li>
            <li>Corrigir dados incompletos ou desatualizados</li>
            <li>Solicitar a exclusão dos seus dados</li>
            <li>Revogar consentimento a qualquer momento</li>
            <li>Solicitar portabilidade dos dados</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">7. Contato</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Para exercer seus direitos ou esclarecer dúvidas, entre em contato pelo e-mail: <strong>support@escalax.app.br</strong>
          </p>
        </section>

        <footer className="pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} EscalaX. Todos os direitos reservados.</p>
          <div className="flex justify-center gap-4 mt-2">
            <Link to="/terms" className="text-xs text-primary hover:underline">Termos de Uso</Link>
            <Link to="/support" className="text-xs text-primary hover:underline">Suporte</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
