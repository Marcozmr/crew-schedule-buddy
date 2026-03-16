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

export function FeedbackFAB() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'choose' | 'form'>('choose');
  const [type, setType] = useState<string>('suggestion');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const reset = () => { setStep('choose'); setType('suggestion'); setSubject(''); setMessage(''); setEmail(''); };
  const close = () => { setOpen(false); setTimeout(reset, 300); };

  const handleSend = async () => {
    if (!message.trim()) { toast.error('Escreva uma mensagem'); return; }
    if (!user) return;
    setSending(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('feedback_messages') as any).insert({
      user_id: user.id, type, subject: subject || null, message, email: email || null, route: location.pathname, status: 'pending',
    });
    setSending(false);
    if (error) { toast.error('Erro ao enviar'); return; }
    toast.success('Obrigado pelo feedback!');
    close();
  };

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full gradient-sky shadow-elevated flex items-center justify-center text-primary-foreground hover:scale-105 active:scale-95 transition-transform"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
              className="bg-card rounded-2xl shadow-elevated w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-semibold text-foreground">{step === 'choose' ? 'Como podemos ajudar?' : TYPES.find(t => t.value === type)?.label}</h3>
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
                  <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Assunto (opcional)" className="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
                  <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Sua mensagem..." rows={4} className="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none" />
                  <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email para resposta (opcional)" className="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
                  <div className="flex gap-2">
                    <button onClick={() => setStep('choose')} className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm hover:bg-muted/80">Voltar</button>
                    <button onClick={handleSend} disabled={sending} className="flex-1 px-4 py-2 rounded-lg gradient-sky text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50">
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
