import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Mail, Send, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { submitSupport } from '@/lib/services/support-service';
import { useAuth } from '@/lib/auth-context';
import { motion } from 'framer-motion';

export default function SupportPage() {
  const { profile } = useAuth();
  const [name, setName] = useState(profile?.name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSending(true);
    setStatus('idle');
    setErrorMsg('');

    const result = await submitSupport({
      name,
      email,
      message,
      type: 'contact',
      subject: 'Contato via suporte',
      route: '/support',
    });

    setSending(false);

    if (result.success && result.emailSent) {
      setStatus('success');
      setMessage('');
      return;
    }

    setStatus('error');
    setErrorMsg(
      result.stored
        ? `Mensagem registrada, mas o envio do e-mail falhou. ${result.error || ''}`.trim()
        : result.error || 'Erro ao enviar. Tente novamente.',
    );
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Central de suporte</h1>
          <p className="text-sm text-muted-foreground mt-1">Fale com a equipe do EscalaX</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-6 mb-6"
        >
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" /> Enviar mensagem
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Nome</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" className="bg-secondary/50 border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">E-mail</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" type="email" className="bg-secondary/50 border-border" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Mensagem</Label>
              <Textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Como podemos ajudar?"
                rows={4}
                className="bg-secondary/50 border-border resize-none"
              />
            </div>

            {status === 'success' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-sm text-success bg-success/10 p-3 rounded-xl">
                <CheckCircle className="w-4 h-4" /> E-mail enviado com sucesso.
              </motion.div>
            )}
            {status === 'error' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-xl">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </motion.div>
            )}

            <Button type="submit" disabled={sending || !message.trim()} className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              {sending ? 'Enviando...' : 'Enviar mensagem'}
            </Button>
          </form>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Perguntas frequentes</h2>
          <div className="space-y-2">
            {[
              { q: 'Como importar minha escala?', a: 'No dashboard, toque em importar, envie o PDF da escala e aguarde o processamento automático.' },
              { q: 'Meus dados estão seguros?', a: 'Sim. O app usa criptografia em trânsito e políticas de acesso por usuário.' },
              { q: 'Como funciona o cálculo de descanso?', a: 'A análise operacional considera RBAC 117, Lei 13.475 e regras LATAM já configuradas no projeto.' },
              { q: 'Posso usar em mais de um dispositivo?', a: 'Sim. Sua conta permanece sincronizada entre navegador, PWA e celular.' },
            ].map((item, i) => (
              <details key={i} className="group rounded-xl bg-secondary/50">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">{item.q}</summary>
                <p className="px-4 pb-3 text-sm text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </motion.div>

        <footer className="pt-6 text-center">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} EscalaX</p>
          <div className="flex justify-center gap-4 mt-2">
            <Link to="/privacy" className="text-xs text-primary hover:underline">Privacidade</Link>
            <Link to="/terms" className="text-xs text-primary hover:underline">Termos</Link>
          </div>
        </footer>
      </div>
    </AppLayout>
  );
}
