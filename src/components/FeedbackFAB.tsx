import { useState } from 'react';
import { MessageCircle, X, Send, Lightbulb, Bug, Mail } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const TYPES = [
  { value: 'suggestion', label: 'Sugerir melhoria', icon: Lightbulb, color: 'text-yellow-500' },
  { value: 'bug', label: 'Relatar problema', icon: Bug, color: 'text-destructive' },
  { value: 'contact', label: 'Entrar em contato', icon: Mail, color: 'text-primary' },
] as const;

const SUPPORT_EMAIL = 'support@escalax.app.br';

function buildMailtoUrl(subject: string, body: string) {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

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

  const reset = () => {
    setStep('choose');
    setType('suggestion');
    setSubject('');
    setMessage('');
    setName(profile?.name || '');
    setEmail(user?.email || '');
  };

  const close = () => { setOpen(false); setTimeout(reset, 300); };

  const handleOpen = () => {
    setName(profile?.name || '');
    setEmail(user?.email || '');
    setOpen(true);
  };

  const categoryLabel = TYPES.find(t => t.value === type)?.label || type;

  const handleSend = async () => {
    if (!message.trim()) { toast.error('Escreva uma mensagem'); return; }
    if (!user) return;
    setSending(true);

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

      if (data?.sent) {
        toast.success('Mensagem enviada com sucesso!');
        close();
      } else if (data?.fallback) {
        // Fallback: open mailto
        window.open(buildMailtoUrl(data.subject, data.body), '_blank');
        toast.success('Abrindo seu cliente de e-mail...');
        close();
      } else {
        throw new Error('Resposta inesperada');
      }
    } catch {
      // Ultimate fallback: mailto
      const emailSubject = `[EscalaX] ${categoryLabel} - ${name || 'Usuário'}`;
      const now = new Date().toLocaleString('pt-BR');
      const body = `Categoria: ${categoryLabel}\nNome: ${name}\nE-mail: ${email}\nAssunto: ${subject}\nMensagem:\n${message}\nData/Hora: ${now}`;
      window.open(buildMailtoUrl(emailSubject, body), '_blank');
      toast.info('Abrindo seu cliente de e-mail como alternativa');
      close();
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full gradient-sky shadow-elevated flex items-center justify-center text-primary-foreground hover:scale-105 active:scale-95 transition-transform"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
              className="bg-card rounded-2xl shadow-elevated w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-semibold text-foreground">{step === 'choose' ? 'Como podemos ajudar?' : categoryLabel}</h3>
                <button onClick={close} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
              </div>

              {step === 'choose' ? (
                <div className="p-4 space-y-2">
                  {TYPES.map(t => (
                    <button key={t.value} onClick={() => { setType(t.value); setStep('form'); }}
                      className="w-full flex items-center gap-3 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left">
                      <t.icon className={`w-5 h-5 ${t.color}`} />
                      <span className="font-medium text-foreground">{t.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome"
                    className="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
                  <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Seu e-mail"
                    className="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
                    <span className="text-xs text-muted-foreground">Categoria:</span>
                    <span className="text-sm font-medium text-foreground">{categoryLabel}</span>
                  </div>
                  <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Assunto (opcional)"
                    className="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
                  <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Sua mensagem..." rows={4}
                    className="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none" />
                  <p className="text-xs text-muted-foreground text-center">Nosso time responderá o mais breve possível</p>
                  <div className="flex gap-2">
                    <button onClick={() => setStep('choose')} className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm hover:bg-muted/80">Voltar</button>
                    <button onClick={handleSend} disabled={sending}
                      className="flex-1 px-4 py-2 rounded-lg gradient-sky text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50">
                      <Send className="w-4 h-4" />{sending ? 'Enviando...' : 'Enviar'}
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
