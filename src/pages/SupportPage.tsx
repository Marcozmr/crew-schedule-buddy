import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Mail, Send, Loader2, CheckCircle, AlertTriangle, Info, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AppCard, AppCardSection, SectionLabel } from '@/components/ui/primitives';
import { submitSupport } from '@/lib/services/support-service';
import { reportSupportFlowResult, reportUnexpectedError } from '@/lib/monitoring/errorReporting';
import { useAuth } from '@/lib/auth-context';
import { motion, AnimatePresence } from 'framer-motion';

const FAQ = [
  { q: 'Como importar minha escala?', a: 'No dashboard, toque em importar, envie o PDF da escala e aguarde o processamento automático.' },
  { q: 'Meus dados estão seguros?', a: 'Sim. O app usa criptografia em trânsito e políticas de acesso por usuário.' },
  { q: 'Como funciona o cálculo de descanso?', a: 'A análise operacional considera RBAC 117, Lei 13.475 e regras operacionais configuradas no projeto.' },
  { q: 'Posso usar em mais de um dispositivo?', a: 'Sim. Sua conta permanece sincronizada entre navegador, PWA e celular.' },
];

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.28, ease: 'easeOut' as const },
});

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/60 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-sm font-medium text-foreground">{q}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SupportPage() {
  const { profile, user, loading } = useAuth();
  const [name, setName] = useState(profile?.name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'warning' | 'error'>('idle');
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!message.trim()) return;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
    if (!emailOk) { setStatus('error'); setFeedbackMsg('Informe um e-mail válido para que possamos responder.'); return; }
    if (!user || loading) { setStatus('error'); setFeedbackMsg(loading ? 'Aguarde carregar a sessão…' : 'Faça login para enviar a mensagem.'); return; }

    setSending(true); setStatus('idle'); setFeedbackMsg('');
    let result: Awaited<ReturnType<typeof submitSupport>>;
    try {
      result = await submitSupport({ name, email, message, type: 'contact', subject: 'Contato via suporte', route: '/support' });
    } catch (e) {
      reportUnexpectedError(e, { flow: 'support_submit' });
      setSending(false); setStatus('error'); setFeedbackMsg('Não foi possível enviar. Tente novamente.'); return;
    }

    setSending(false);
    reportSupportFlowResult(result.outcome, result.userMessage);

    if (result.outcome === 'email_sent') { setStatus('success'); setFeedbackMsg(result.userMessage); setMessage(''); return; }
    if (['saved_email_failed', 'config_error', 'validation_error'].includes(result.outcome)) { setStatus('warning'); setFeedbackMsg(result.userMessage); return; }
    setStatus('error'); setFeedbackMsg(result.userMessage);
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Formulário de contato */}
        <motion.div {...fade(0)}>
          <SectionLabel>Enviar mensagem</SectionLabel>
          <AppCard>
            <AppCardSection>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Central de suporte</p>
                  <p className="text-xs text-muted-foreground">Fale com a equipe EscalaX</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!user && (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                    Faça <Link to="/login" className="font-semibold text-primary underline">login</Link> para enviar mensagem ao suporte.
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nome</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">E-mail</Label>
                    <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" type="email" className="h-11" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mensagem</Label>
                  <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Como podemos ajudar?" rows={4} className="resize-none" />
                </div>

                <AnimatePresence mode="wait">
                  {status === 'success' && (
                    <motion.div key="ok" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex items-start gap-2 rounded-xl bg-success/10 p-3 text-sm text-success">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{feedbackMsg}</span>
                    </motion.div>
                  )}
                  {status === 'warning' && (
                    <motion.div key="warn" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" /><span>{feedbackMsg}</span>
                    </motion.div>
                  )}
                  {status === 'error' && (
                    <motion.div key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{feedbackMsg}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Button type="submit" disabled={sending || !message.trim() || !user || loading} className="w-full h-11 font-semibold">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  {sending ? 'Enviando...' : 'Enviar mensagem'}
                </Button>
              </form>
            </AppCardSection>
          </AppCard>
        </motion.div>

        {/* FAQ */}
        <motion.div {...fade(0.1)}>
          <SectionLabel>Perguntas frequentes</SectionLabel>
          <AppCard>
            {FAQ.map((item, i) => <FaqItem key={i} q={item.q} a={item.a} />)}
          </AppCard>
        </motion.div>

        {/* Footer */}
        <motion.div {...fade(0.18)} className="pb-4 text-center space-y-2">
          <p className="text-xs text-muted-foreground">© 2026 EscalaX · Todos os direitos reservados</p>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link to="/legal/terms" className="text-xs text-primary hover:underline">Termos</Link>
            <Link to="/legal/privacy" className="text-xs text-primary hover:underline">Privacidade</Link>
            <Link to="/legal/lgpd" className="text-xs text-primary hover:underline">LGPD</Link>
            <Link to="/about" className="text-xs text-primary hover:underline">Sobre</Link>
          </div>
        </motion.div>

      </div>
    </AppLayout>
  );
}
