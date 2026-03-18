import { useState } from 'react';
import { MessageCircle, X, Send, Lightbulb, Bug, Mail } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { checkRateLimit, getRateLimitMessage } from '@/lib/rate-limit';
import { submitSupport, type SupportPayload } from '@/lib/services/support-service';

const TYPES = [
  { value: 'suggestion' as const, label: 'Sugerir melhoria', icon: Lightbulb, color: 'text-warning' },
  { value: 'bug' as const, label: 'Relatar problema', icon: Bug, color: 'text-destructive' },
  { value: 'contact' as const, label: 'Entrar em contato', icon: Mail, color: 'text-primary' },
];

const SUPPORT_EMAIL = 'support@escalax.app.br';

export function FeedbackFAB() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'choose' | 'form'>('choose');
  const [type, setType] = useState<SupportPayload['type']>('suggestion');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const reset = () => {
    setStep('choose');
    setType('suggestion');
    setSubject('');
    setMessage('');
    setName(profile?.name || '');
    setEmail(user?.email || '');
  };

  const close = () => {
    setOpen(false);
    setTimeout(reset, 300);
  };

  const handleOpen = () => {
    setName(profile?.name || '');
    setEmail(user?.email || '');
    setOpen(true);
  };

  const categoryLabel = TYPES.find((item) => item.value === type)?.label || type;

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Escreva uma mensagem.');
      return;
    }
    if (!user) {
      toast.error('Faça login para enviar sua mensagem.');
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

      if (result.success && result.emailSent) {
        toast.success('E-mail enviado com sucesso.');
        close();
        return;
      }

      toast.error(result.stored ? 'Mensagem registrada, mas o e-mail não foi entregue.' : result.error || 'Erro ao enviar. Tente novamente.', {
        description: result.technicalError || result.error,
      });
    } catch {
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="fixed right-4 md:right-6 safe-bottom-4 md:safe-bottom-6 z-50 flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full gradient-sky text-primary-foreground shadow-elevated transition-transform hover:scale-105 active:scale-95"
      >
        <MessageCircle className="h-5 w-5 md:h-6 md:w-6" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:p-4 sm:items-center"
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-elevated safe-area-bottom max-h-[min(88dvh,42rem)] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-border p-4">
                <h3 className="font-semibold text-foreground break-words min-w-0">
                  {step === 'choose' ? 'Como podemos ajudar?' : categoryLabel}
                </h3>
                <button onClick={close} className="p-1 text-muted-foreground hover:text-foreground shrink-0">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {step === 'choose' ? (
                <div className="space-y-2 p-4 overflow-y-auto">
                  {TYPES.map((item) => (
                    <button
                      key={item.value}
                      onClick={() => { setType(item.value); setStep('form'); }}
                      className="w-full rounded-xl bg-muted/50 p-4 text-left transition-colors hover:bg-muted min-w-0"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <item.icon className={`h-5 w-5 shrink-0 ${item.color}`} />
                        <span className="font-medium text-foreground break-words">{item.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3 p-4 overflow-y-auto">
                  <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" className="w-full rounded-lg bg-muted px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground" />
                  <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Seu e-mail" className="w-full rounded-lg bg-muted px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground" />
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 min-w-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Categoria:</span>
                    <span className="text-sm font-medium text-foreground break-words">{categoryLabel}</span>
                  </div>
                  <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Assunto (opcional)" className="w-full rounded-lg bg-muted px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground" />
                  <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Sua mensagem..." rows={4} className="w-full resize-none rounded-lg bg-muted px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground break-anywhere" />

                  <p className="text-center text-xs text-muted-foreground break-words">
                    Resposta em até 24h {' · '}
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(SUPPORT_EMAIL); toast.success('E-mail copiado.'); }}
                      className="underline hover:text-foreground break-all"
                    >
                      {SUPPORT_EMAIL}
                    </button>
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={() => setStep('choose')} className="rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground hover:bg-muted/80 w-full sm:w-auto">
                      Voltar
                    </button>
                    <button onClick={handleSend} disabled={sending} className="flex w-full sm:flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-primary-foreground gradient-sky hover:opacity-90 disabled:opacity-50">
                      <Send className="h-4 w-4 shrink-0" />
                      {sending ? 'Enviando...' : 'Enviar'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
