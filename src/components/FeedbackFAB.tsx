import { useState, useEffect, useCallback, type FormEvent } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { MessageCircle, X, Send, Lightbulb, Bug, Mail } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { checkRateLimit, getRateLimitMessage } from '@/lib/rate-limit';
import { submitSupport, type SupportPayload } from '@/lib/services/support-service';
import { cn } from '@/lib/utils';

const TYPES = [
  { value: 'suggestion' as const, label: 'Sugerir melhoria', icon: Lightbulb, color: 'text-warning' },
  { value: 'bug' as const, label: 'Relatar problema', icon: Bug, color: 'text-destructive' },
  { value: 'contact' as const, label: 'Entrar em contato', icon: Mail, color: 'text-primary' },
];

const SUPPORT_EMAIL = 'contato@escalax.app.br';

const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log('[FeedbackFAB]', ...args);
};

export function FeedbackFAB() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'choose' | 'form'>('choose');
  const [type, setType] = useState<SupportPayload['type']>('suggestion');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const resetFormFields = useCallback(() => {
    setStep('choose');
    setType('suggestion');
    setSubject('');
    setMessage('');
    setName(profile?.name || '');
    setEmail(user?.email || '');
  }, [profile?.name, user?.email]);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setName(profile?.name || '');
      setEmail(user?.email || '');
      setStep('choose');
      setOpen(true);
      return;
    }
    setOpen(false);
    window.setTimeout(resetFormFields, 200);
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Escreva uma mensagem.');
      return;
    }
    const emailTrim = (email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      toast.error('Informe um e-mail válido no campo de e-mail.');
      return;
    }
    if (!user || loading) {
      toast.error(loading ? 'Aguarde carregar a sessão…' : 'Faça login para enviar sua mensagem.');
      return;
    }
    if (!checkRateLimit('support', 3, 60_000)) {
      toast.error(getRateLimitMessage());
      return;
    }

    setSending(true);
    try {
      const result = await submitSupport({
        name: name || 'Usuário',
        email: email || '',
        type,
        subject: subject || '',
        message,
        route: location.pathname,
      });

      if (result.outcome === 'email_sent') {
        toast.success(result.userMessage);
        handleOpenChange(false);
        return;
      }

      if (
        result.outcome === 'saved_email_failed' ||
        result.outcome === 'config_error' ||
        result.outcome === 'validation_error'
      ) {
        toast(result.userMessage, { duration: 9000 });
        handleOpenChange(false);
        return;
      }

      if (result.outcome === 'register_failed' || result.outcome === 'unauthorized') {
        toast.error(result.userMessage);
        return;
      }

      toast.error(result.userMessage);
    } catch (err) {
      console.error('[FeedbackFAB] submitSupport', err);
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void handleSend();
  };

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    devLog('open (estado):', open);
  }, [open]);

  const categoryLabel = TYPES.find((item) => item.value === type)?.label || type;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            'pointer-events-auto fixed right-4 lg:right-6 safe-bottom-fab lg:safe-bottom-6 z-[100] flex h-12 w-12 lg:h-14 lg:w-14 items-center justify-center rounded-full gradient-sky text-primary-foreground shadow-elevated transition-transform hover:scale-105 active:scale-95',
            open && 'pointer-events-none opacity-0',
          )}
          aria-label="Abrir suporte"
          aria-expanded={open}
        >
          <MessageCircle className="h-5 w-5 md:h-6 md:w-6" />
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-[200] bg-black/50 backdrop-blur-[1px]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed z-[210] flex max-h-[min(88dvh,42rem)] w-full max-w-md flex-col overflow-hidden border border-border bg-card shadow-elevated outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:slide-out-to-bottom-2 data-[state=open]:slide-in-from-bottom-2',
            'safe-area-bottom',
            'left-0 right-0 bottom-0 rounded-t-2xl border-b-0',
            'sm:left-[50%] sm:top-[50%] sm:bottom-auto sm:right-auto sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl sm:border-b',
          )}
        >
          <DialogPrimitive.Description className="sr-only">
            Envie sugestões, relatos ou pedidos de contato à equipe EscalaX.
          </DialogPrimitive.Description>

          <div className="flex items-center justify-between border-b border-border p-4">
            <DialogPrimitive.Title className="min-w-0 break-words text-left text-base font-semibold text-foreground">
              {step === 'choose' ? 'Como podemos ajudar?' : categoryLabel}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              type="button"
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          {step === 'choose' ? (
            <div className="space-y-2 overflow-y-auto p-4">
              {TYPES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setType(item.value);
                    setStep('form');
                  }}
                  className="min-w-0 w-full rounded-xl bg-muted/50 p-4 text-left transition-colors hover:bg-muted"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <item.icon className={`h-5 w-5 shrink-0 ${item.color}`} />
                    <span className="break-words font-medium text-foreground">{item.label}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <form className="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto p-4" onSubmit={handleFormSubmit} noValidate>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Seu nome"
                autoComplete="name"
                className="w-full rounded-lg bg-muted px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Seu e-mail"
                type="email"
                autoComplete="email"
                className="w-full rounded-lg bg-muted px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                <span className="whitespace-nowrap text-xs text-muted-foreground">Categoria:</span>
                <span className="break-words text-sm font-medium text-foreground">{categoryLabel}</span>
              </div>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Assunto (opcional)"
                className="w-full rounded-lg bg-muted px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Sua mensagem..."
                rows={4}
                className="w-full resize-none rounded-lg bg-muted px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground break-anywhere"
              />

              <p className="break-words text-center text-xs text-muted-foreground">
                Resposta em até 24h {' · '}
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(SUPPORT_EMAIL);
                    toast.success('E-mail copiado.');
                  }}
                  className="break-all underline hover:text-foreground"
                >
                  {SUPPORT_EMAIL}
                </button>
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setStep('choose')}
                  className="w-full rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground hover:bg-muted/80 sm:w-auto"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={sending || !user || loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-primary-foreground gradient-sky hover:opacity-90 disabled:opacity-50 sm:flex-1"
                >
                  <Send className="h-4 w-4 shrink-0" />
                  {sending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </form>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
