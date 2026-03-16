import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plane, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import airplaneBg from '@/assets/airplane-bg.jpg';

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
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message || 'Erro ao enviar email');
    } else {
      setSent(true);
      toast.success('Email de recuperação enviado!');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
      <img src={airplaneBg} alt="Avião voando sobre nuvens" className="absolute inset-0 w-full h-full object-cover scale-105" />
      <div className="absolute inset-0 bg-black/40" />

      <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6 }} className="relative z-10 w-full max-w-md mx-4">
        <div className="rounded-2xl p-8 shadow-elevated backdrop-blur-md bg-black/20 border border-white/10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl gradient-sky flex items-center justify-center mb-4 shadow-elevated">
              <Plane className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">EscalaX</h1>
          </div>

          {sent ? (
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-2">Email enviado! ✉️</h2>
              <p className="text-white/60 text-sm mb-4">Verifique sua caixa de entrada e clique no link para redefinir sua senha.</p>
              <Link to="/">
                <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                  <ArrowLeft className="w-4 h-4 mr-2" />Voltar ao login
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white mb-1">Esqueci minha senha</h2>
              <p className="text-white/50 mb-6 text-sm">Digite seu email para receber um link de recuperação</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white/80">Email</Label>
                  <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/40" />
                </div>
                <Button type="submit" disabled={loading} className="w-full h-12 gradient-sky text-white font-semibold text-base">
                  {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                </Button>
              </form>

              <Link to="/" className="mt-4 text-sm text-white/50 hover:text-white/80 flex items-center justify-center gap-1">
                <ArrowLeft className="w-3 h-3" />Voltar ao login
              </Link>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
