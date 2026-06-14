import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plane, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { getAuthCallbackUrl } from '@/lib/auth/authRedirect';
import { formatAuthErrorForUser } from '@/lib/auth/formatAuthError';
import { emailDomainOnly, logAuthAuditEvent } from '@/lib/auth/authAudit';
import { checkRateLimit, getRateLimitMessage } from '@/lib/rate-limit';
import { assertAuthRateLimitAllowed } from '@/lib/auth/authRateLimitClient';
import { AuthRateLimitError } from '@/lib/auth/authRateLimitError';
import { reportAuthFlowFailure, reportOperationalEvent } from '@/lib/monitoring/errorReporting';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import airplaneBg from '@/assets/airplane-bg.jpg';

/** Texto neutro: o Supabase não revela se o email existe (anti-enumeração). */
export const FORGOT_PASSWORD_SUCCESS_COPY = {
  title: 'Verifique o seu email',
  body:
    'Se existir uma conta com este endereço, enviaremos um link para redefinir a senha. Verifique a caixa de entrada e o spam.',
} as const;

/** Botão/link visível sobre o cartão em vidro — evita variant outline (bg-card) que quebra no hover. */
const glassButtonClass =
  'w-full min-h-12 border border-white/35 bg-white/15 text-white shadow-sm transition-colors hover:bg-white/28 hover:text-white focus-visible:ring-2 focus-visible:ring-white/55 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20 dark:bg-white/15 dark:text-white dark:hover:bg-white/28';

const glassTextLinkClass =
  'mt-4 inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium text-white/90 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black/30';

function maskEmailForDevLog(email: string): string {
  const t = email.trim().toLowerCase();
  const at = t.indexOf('@');
  if (at < 1) return '[inválido]';
  const local = t.slice(0, at);
  const domain = t.slice(at + 1);
  const masked = local.length <= 1 ? '*' : `${local[0]}***`;
  return `${masked}@${domain}`;
}

function logForgotPasswordDev(phase: string, payload: Record<string, unknown>) {
  if (!import.meta.env.DEV) return;
  console.info('[forgot-password]', phase, payload);
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Digite seu email');
      return;
    }
    if (!checkRateLimit('forgot-password', 5, 300_000)) {
      logAuthAuditEvent('password_reset_rate_limited', { domain: emailDomainOnly(email.trim().toLowerCase()) });
      reportOperationalEvent('forgot_password: client rate limit', { flow: 'forgot_password' });
      toast.error(getRateLimitMessage());
      return;
    }
    setLoading(true);
    const normalized = email.trim().toLowerCase();

    try {
      await assertAuthRateLimitAllowed('forgot_password', normalized);
    } catch (e) {
      setLoading(false);
      if (AuthRateLimitError.is(e)) {
        logAuthAuditEvent('password_reset_rate_limited', { domain: emailDomainOnly(normalized) });
        reportOperationalEvent('forgot_password: servidor rate limit', { flow: 'forgot_password' });
      }
      toast.error(formatAuthErrorForUser(e));
      return;
    }

    const redirectTo = getAuthCallbackUrl();
    logForgotPasswordDev('request', {
      email_masked: maskEmailForDevLog(normalized),
      redirect_to: redirectTo,
      origin: typeof window !== 'undefined' ? window.location.origin : '',
    });

    const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
      redirectTo,
    });

    logForgotPasswordDev('response', {
      email_masked: maskEmailForDevLog(normalized),
      redirect_to: redirectTo,
      supabase_error_code: error?.code ?? null,
      supabase_error_status: (error as { status?: number } | null)?.status ?? null,
      has_error: !!error,
    });

    if (error) {
      logAuthAuditEvent('password_reset_failed', {
        domain: emailDomainOnly(normalized),
        code: error.code ?? 'unknown',
      });
      reportAuthFlowFailure('forgot_password', error, { supabase_code: error.code });
      toast.error(formatAuthErrorForUser(error));
      setLoading(false);
      return;
    }

    /**
     * Sucesso sem erro: o GoTrue envia email apenas se o utilizador existir, mas a API
     * responde igual por segurança (anti-enumeração). A UI não deve prometer "email enviado".
     */
    logAuthAuditEvent('password_reset_requested', {
      domain: emailDomainOnly(normalized),
      accepted: true,
    });
    logForgotPasswordDev('success_no_supabase_error', {
      note:
        'A API não revela se o email existe. Se nada chegar, verifique SMTP/templates e Redirect URLs no Supabase.',
      redirect_to: redirectTo,
    });
    setSent(true);
    toast.success(FORGOT_PASSWORD_SUCCESS_COPY.body);
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
      <img src={airplaneBg} alt="" className="absolute inset-0 w-full h-full object-cover scale-105" />
      <div className="absolute inset-0 bg-black/45" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="rounded-2xl p-8 shadow-elevated backdrop-blur-md bg-black/25 border border-white/15">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl gradient-sky flex items-center justify-center mb-4 shadow-elevated">
              <Plane className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">EscalaX</h1>
          </div>

          {sent ? (
            <div className="text-center space-y-4">
              <h2 className="text-xl font-bold text-white">{FORGOT_PASSWORD_SUCCESS_COPY.title}</h2>
              <p className="text-sm leading-relaxed text-white/85">{FORGOT_PASSWORD_SUCCESS_COPY.body}</p>
              <p className="text-xs text-white/55">O envio pode demorar alguns minutos.</p>
              <Button asChild size="lg" className={cn(glassButtonClass)}>
                <Link to="/login" className="gap-2">
                  <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden />
                  Voltar ao login
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white mb-1">Esqueci minha senha</h2>
              <p className="text-white/65 mb-6 text-sm">Digite seu email para receber um link de recuperação</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white/85">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 border-white/25 bg-white/12 text-white placeholder:text-white/45 focus-visible:ring-white/40"
                    autoComplete="email"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-12 gradient-sky font-semibold text-base text-white shadow-md hover:opacity-95 disabled:opacity-60"
                >
                  {loading ? 'Enviando…' : 'Enviar link de recuperação'}
                </Button>
              </form>

              <Link to="/login" className={cn(glassTextLinkClass)} aria-label="Voltar ao login">
                <ArrowLeft className="w-3.5 h-3.5 shrink-0" aria-hidden />
                Voltar ao login
              </Link>
            </>
          )}
        </div>

        <p className="text-center mt-6 text-white/35 text-xs">
          © {new Date().getFullYear()} EscalaX. Desenvolvido por Marcos Vinicius.
        </p>
      </motion.div>
    </div>
  );
}
