import { useState } from 'react';
import { MessageCircle, X, Send, Lightbulb, Bug, Mail } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { checkRateLimit, getRateLimitMessage } from '@/lib/rate-limit';

const TYPES = [
  { value: 'suggestion', label: 'Sugerir melhoria', icon: Lightbulb, color: 'text-yellow-500' },
  { value: 'bug', label: 'Relatar problema', icon: Bug, color: 'text-destructive' },
  { value: 'contact', label: 'Entrar em contato', icon: Mail, color: 'text-primary' },
] as const;

const SUPPORT_EMAIL = 'support@escalax.app.br';
const GENERIC_SEND_ERROR = 'Não foi possível enviar sua mensagem agora. Tente novamente em instantes.';

export function FeedbackFAB() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'choose' | 'form'>('choose');
  const [type, setType] = useState<string>('suggestion');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const reset = () => {
    setStep('choose');
    setType('suggestion');
    setSubject('');
    setMessage('');
    setName(profile?.name || '');
    setEmail(user?.email || '');
    setSubmitError(null);
  };

  const close = () => {
    setOpen(false);
    setTimeout(reset, 300);
  };

  const handleOpen = () => {
    setName(profile?.name || '');
    setEmail(user?.email || '');
    setSubmitError(null);
    setOpen(true);
  };

  const copySupportEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      toast.success('E-mail de suporte copiado.');
    } catch {
      toast.info(`E-mail de suporte: ${SUPPORT_EMAIL}`);
    }
  };

  const showSupportEmail = () => {
    toast.info(`E-mail de suporte: ${SUPPORT_EMAIL}`);
  };

  const categoryLabel = TYPES.find((t) => t.value === type)?.label || type;

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Escreva uma mensagem');
      return;
    }

    if (!user) {
      toast.error('Faça login para enviar sua mensagem.');
      return;
    }

    setSending(true);
    setSubmitError(null);

    try {
      const { data, error } = await supabase.functions.invoke('send-support-email', {
        body: {
          name: name || 'Usuário',
          email: email || '',
          type,
          subject: subject || '',
          message,
          route: location.pathname,
        },
      });

      if (error) throw error;
      if (!data?.sent) throw new Error(data?.error || GENERIC_SEND_ERROR);

      toast.success('Mensagem enviada com sucesso. Nosso time responderá o mais breve possível.');
      close();
    } catch {
      setSubmitError(GENERIC_SEND_ERROR);
      toast.error(GENERIC_SEND_ERROR);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full gradient-sky text-primary-foreground shadow-elevated transition-transform hover:scale-105 active:scale-95"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-elevated"
            >
              <div className="flex items-center justify-between border-b border-border p-4">
                <h3 className="font-semibold text-foreground">
                  {step === 'choose' ? 'Como podemos ajudar?' : categoryLabel}
                </h3>
                <button onClick={close} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {step === 'choose' ? (
                <div className="space-y-2 p-4">
                  {TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => {
                        setType(t.value);
                        setStep('form');
                        setSubmitError(null);
                      }}
                      className="w-full rounded-xl bg-muted/50 p-4 text-left transition-colors hover:bg-muted"
                    >
                      <div className="flex items-center gap-3">
                        <t.icon className={`h-5 w-5 ${t.color}`} />
                        <span className="font-medium text-foreground">{t.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3 p-4">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full rounded-lg bg-muted px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Seu e-mail"
                    className="w-full rounded-lg bg-muted px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                    <span className="text-xs text-muted-foreground">Categoria:</span>
                    <span className="text-sm font-medium text-foreground">{categoryLabel}</span>
                  </div>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Assunto (opcional)"
                    className="w-full rounded-lg bg-muted px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Sua mensagem..."
                    rows={4}
                    className="w-full resize-none rounded-lg bg-muted px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />

                  {submitError && (
                    <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                      <p className="text-xs text-destructive">{submitError}</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={copySupportEmail}
                          className="rounded-md bg-muted px-3 py-1.5 text-xs text-foreground hover:bg-muted/80"
                        >
                          Copiar e-mail de suporte
                        </button>
                        <button
                          type="button"
                          onClick={showSupportEmail}
                          className="rounded-md bg-muted px-3 py-1.5 text-xs text-foreground hover:bg-muted/80"
                        >
                          Ver e-mail de suporte
                        </button>
                      </div>
                    </div>
                  )}

                  <p className="text-center text-xs text-muted-foreground">Nosso time responderá o mais breve possível</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setStep('choose');
                        setSubmitError(null);
                      }}
                      className="rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground hover:bg-muted/80"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={sending}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-primary-foreground gradient-sky hover:opacity-90 disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      {sending ? 'Enviando sua mensagem...' : 'Enviar'}
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
