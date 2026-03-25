import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { FileText, Scale, Shield } from 'lucide-react';
import { LegalDocument } from '@/components/legal/LegalDocument';

export type LegalDocumentKind = 'terms' | 'privacy' | 'lgpd';

function isLegalDocumentKind(s: string | undefined): s is LegalDocumentKind {
  return s === 'terms' || s === 'privacy' || s === 'lgpd';
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 mt-8 first:mt-0">
      <h2 className="text-base sm:text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

function Ul({ children }: { children: ReactNode }) {
  return <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1.5 pl-0.5">{children}</ul>;
}

function TermsBody() {
  return (
    <>
      <p className="text-sm text-muted-foreground mt-2">Última atualização: março de 2026</p>
      <Section title="1. Aceitação dos Termos">
        <P>
          Ao acessar ou utilizar o EscalaX, você concorda com estes Termos de Uso. Se não concordar, não utilize o serviço.
        </P>
      </Section>
      <Section title="2. Descrição do Serviço">
        <P>
          O EscalaX é uma plataforma de gestão de escalas para tripulantes de aviação, oferecendo importação de rosters, cálculos de jornada e descanso, controle de documentos, troca de voos e notificações operacionais.
        </P>
      </Section>
      <Section title="3. Conta do Usuário">
        <P>
          Você é responsável por manter a confidencialidade das suas credenciais e por todas as atividades realizadas na sua conta. Notifique-nos imediatamente sobre qualquer uso não autorizado.
        </P>
      </Section>
      <Section title="4. Uso Aceitável">
        <P>Você concorda em:</P>
        <Ul>
          <li>Utilizar o serviço apenas para fins legítimos e profissionais</li>
          <li>Não tentar acessar dados de outros usuários</li>
          <li>Não realizar engenharia reversa do sistema</li>
          <li>Não utilizar o serviço para fins ilegais</li>
        </Ul>
      </Section>
      <Section title="5. Propriedade Intelectual">
        <P>
          Todo o conteúdo, design, código e funcionalidades do EscalaX são de propriedade exclusiva da EscalaX e estão protegidos pelas leis de propriedade intelectual.
        </P>
      </Section>
      <Section title="6. Limitação de Responsabilidade">
        <P>
          O EscalaX é uma ferramenta auxiliar e não substitui sistemas oficiais de controle de jornada da companhia aérea. Os cálculos e informações são fornecidos como referência e não possuem caráter oficial ou vinculante.
        </P>
      </Section>
      <Section title="7. Disponibilidade">
        <P>
          Nos esforçamos para manter o serviço disponível 24 horas por dia, mas não garantimos disponibilidade ininterrupta. Manutenções programadas serão comunicadas com antecedência quando possível.
        </P>
      </Section>
      <Section title="8. Alterações">
        <P>
          Reservamo-nos o direito de alterar estes termos a qualquer momento. Alterações significativas serão comunicadas aos usuários.
        </P>
      </Section>
      <Section title="9. Contato">
        <P>
          Dúvidas sobre estes termos podem ser enviadas para:{' '}
          <strong className="text-foreground">support@escalax.app.br</strong>
        </P>
      </Section>
    </>
  );
}

function PrivacyBody() {
  return (
    <>
      <p className="text-sm text-muted-foreground mt-2">Última atualização: março de 2026</p>
      <Section title="1. Introdução">
        <P>
          A EscalaX respeita sua privacidade e está comprometida com a proteção dos seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
        </P>
      </Section>
      <Section title="2. Dados Coletados">
        <P>Coletamos apenas os dados necessários para o funcionamento do serviço:</P>
        <Ul>
          <li>Nome e e-mail (para identificação e autenticação)</li>
          <li>Dados de escala e roster importados pelo usuário</li>
          <li>Dados de perfil profissional (companhia aérea, registro)</li>
          <li>Mensagens de suporte enviadas pelo app</li>
        </Ul>
      </Section>
      <Section title="3. Finalidade do Tratamento">
        <P>Seus dados são utilizados exclusivamente para:</P>
        <Ul>
          <li>Gerenciar sua conta e autenticação</li>
          <li>Processar e exibir escalas de voo</li>
          <li>Calcular jornadas, descanso e regulamentações</li>
          <li>Enviar notificações operacionais</li>
          <li>Responder solicitações de suporte</li>
        </Ul>
      </Section>
      <Section title="4. Compartilhamento">
        <P>
          Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para fins de marketing. Dados podem ser compartilhados apenas quando exigido por lei ou para operar o serviço (infraestrutura em nuvem).
        </P>
      </Section>
      <Section title="5. Segurança">
        <P>
          Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados, incluindo criptografia em trânsito e em repouso, controle de acesso por usuário e políticas de segurança no nível do banco de dados.
        </P>
      </Section>
      <Section title="6. Seus Direitos (LGPD)">
        <P>Você tem direito a:</P>
        <Ul>
          <li>Acessar seus dados pessoais</li>
          <li>Corrigir dados incompletos ou desatualizados</li>
          <li>Solicitar a exclusão dos seus dados</li>
          <li>Revogar consentimento a qualquer momento</li>
          <li>Solicitar portabilidade dos dados</li>
        </Ul>
      </Section>
      <Section title="7. Contato">
        <P>
          Para exercer seus direitos ou esclarecer dúvidas, entre em contato pelo e-mail:{' '}
          <strong className="text-foreground">support@escalax.app.br</strong>
        </P>
      </Section>
    </>
  );
}

function LgpdBody() {
  return (
    <>
      <p className="text-sm text-muted-foreground mt-2">Última atualização: março de 2026</p>
      <Section title="1. Controlador e encarregado">
        <P>
          O tratamento de dados pessoais no EscalaX observa a LGPD (Lei nº 13.709/2018). Para questões relacionadas à privacidade e proteção de dados, utilize o canal{' '}
          <strong className="text-foreground">support@escalax.app.br</strong>.
        </P>
      </Section>
      <Section title="2. Base legal">
        <P>Tratamos dados com base em:</P>
        <Ul>
          <li>Execução de contrato e de procedimentos preliminares (prestação do serviço ao usuário cadastrado)</li>
          <li>Legítimo interesse, quando aplicável, para melhorias de segurança e experiência</li>
          <li>Cumprimento de obrigação legal ou regulatória</li>
          <li>Consentimento, quando exigido para finalidades específicas</li>
        </Ul>
      </Section>
      <Section title="3. Direitos do titular">
        <P>
          Nos termos dos artigos 18 e seguintes da LGPD, você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação de dados desnecessários, informação sobre compartilhamento e revogação de consentimento, quando cabível.
        </P>
      </Section>
      <Section title="4. Prazo de resposta">
        <P>
          Responderemos às solicitações no prazo legal, mediante confirmação de identidade quando necessário para proteger seus dados contra acesso indevido.
        </P>
      </Section>
      <Section title="5. Relação com a Política de Privacidade">
        <P>
          Esta política complementa a Política de Privacidade do EscalaX. Em caso de conflito interpretativo quanto a dados pessoais, prevalece o disposto na legislação aplicável.
        </P>
      </Section>
    </>
  );
}

const CONFIG: Record<
  LegalDocumentKind,
  { title: string; shortTitle: string; icon: typeof FileText; body: ReactNode; navLinks: { label: string; to: string }[] }
> = {
  terms: {
    title: 'Termos de Uso — EscalaX',
    shortTitle: 'Termos de Uso',
    icon: FileText,
    body: <TermsBody />,
    navLinks: [
      { label: 'Política de Privacidade', to: '/legal/privacy' },
      { label: 'Política LGPD', to: '/legal/lgpd' },
      { label: 'Suporte', to: '/support' },
    ],
  },
  privacy: {
    title: 'Política de Privacidade — EscalaX',
    shortTitle: 'Política de Privacidade',
    icon: Shield,
    body: <PrivacyBody />,
    navLinks: [
      { label: 'Termos de Uso', to: '/legal/terms' },
      { label: 'Política LGPD', to: '/legal/lgpd' },
      { label: 'Suporte', to: '/support' },
    ],
  },
  lgpd: {
    title: 'Política LGPD — EscalaX',
    shortTitle: 'Política LGPD',
    icon: Scale,
    body: <LgpdBody />,
    navLinks: [
      { label: 'Termos de Uso', to: '/legal/terms' },
      { label: 'Política de Privacidade', to: '/legal/privacy' },
      { label: 'Suporte', to: '/support' },
    ],
  },
};

export default function LegalPage() {
  const { document: docParam } = useParams<{ document: string }>();
  if (!isLegalDocumentKind(docParam)) {
    return <Navigate to="/" replace />;
  }
  const c = CONFIG[docParam];
  return (
    <LegalDocument title={c.title} shortTitle={c.shortTitle} icon={c.icon} navLinks={c.navLinks}>
      {c.body}
    </LegalDocument>
  );
}
