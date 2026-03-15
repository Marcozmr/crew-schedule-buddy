import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import airplaneBg from '@/assets/airplane-bg.jpg';

type Mode = 'login' | 'register' | 'forgot';

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp, session } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (session) {
      navigate('/dashboard', { replace: true });
    }
  }, [session, navigate]);

  if (session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const normalizedEmail = form.email.trim().toLowerCase();

    if (!normalizedEmail) {
      toast.error('Informe seu e-mail');
      setLoading(false);
      return;
    }

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
      }

      setLoading(false);
      return;
    }

    if (!form.password) {
      toast.error('Informe sua senha');
      setLoading(false);
      return;
    }

    if (mode === 'register' && !form.name.trim()) {
      toast.error('Informe seu nome');
      setLoading(false);
      return;
    }

    try {
      if (mode === 'register') {
        await signUp(normalizedEmail, form.password, form.name.trim());
        toast.success('Conta criada com sucesso!');
        navigate('/dashboard');
      } else {
        await signIn(normalizedEmail, form.password);
        toast.success('Bem-vindo de volta!');
        navigate('/dashboard');
      }
    } catch (error: any) {
      const msg = error.message || '';
      if (msg.includes('Invalid login')) {
        toast.error('E-mail ou senha inválidos. Se necessário, use “Esqueceu a senha?” para recuperar.');
      } else if (msg.includes('already registered')) {
        toast.error('Este e-mail já está cadastrado. Faça login.');
      } else {
        toast.error(msg || 'Erro na autenticação');
      }
    }

    setLoading(false);
  };

  const titles: Record<Mode, string> = {
    login: 'Bem-vindo de volta',
    register: 'Crie sua conta',
    forgot: 'Recuperar senha',
  };

  const subtitles: Record<Mode, string> = {
    login: 'Acesse sua escala de voo',
    register: 'Comece a gerenciar sua escala',
    forgot: 'Enviaremos um link para redefinir sua senha',
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
      <img
        src={airplaneBg}
        alt="Avião voando sobre nuvens ao pôr do sol"
        className="absolute inset-0 w-full h-full object-cover scale-105"
      />
      <div className="absolute inset-0 bg-black/40" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="rounded-2xl p-8 shadow-elevated backdrop-blur-md bg-black/20 border border-white/10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl gradient-sky flex items-center justify-center mb-4 shadow-elevated">
              <Plane className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">CrewScale</h1>
            <p className="text-sm text-white/60 mt-1">Gerencie sua escala de voo com inteligência</p>
          </div>

          {mode === 'forgot' && (
            <button onClick={() => setMode('login')} className="flex items-center gap-1 text-white/60 hover:text-white text-sm mb-4 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Voltar ao login
            </button>
          )}

          <h2 className="text-xl font-bold text-white mb-1">{titles[mode]}</h2>
          <p className="text-white/50 mb-6 text-sm">{subtitles[mode]}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white/80">Nome completo</Label>
                <Input
                  id="name"
                  placeholder="Seu nome"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/40"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/80">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="seu@email.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/40"
              />
            </div>

            {mode !== 'forgot' && (
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/80">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="h-12 pr-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div className="text-right">
                <button type="button" onClick={() => setMode('forgot')} className="text-xs text-white/50 hover:text-white transition-colors">
                  Esqueceu a senha?
                </button>
              </div>
            )}

            <Button type="submit" className="w-full h-12 gradient-sky text-white font-semibold text-base" disabled={loading}>
              {loading
                ? 'Carregando...'
                : mode === 'register'
                ? 'Criar conta'
                : mode === 'forgot'
                ? 'Enviar link de recuperação'
                : 'Entrar'}
            </Button>
          </form>

          {mode !== 'forgot' && (
            <p className="mt-6 text-center text-sm text-white/50">
              {mode === 'register' ? 'Já tem conta?' : 'Não tem conta?'}{' '}
              <button onClick={() => setMode(mode === 'register' ? 'login' : 'register')} className="text-white font-medium hover:underline">
                {mode === 'register' ? 'Fazer login' : 'Criar conta'}
              </button>
            </p>
          )}
        </div>

        <p className="text-center mt-6 text-white/30 text-xs">
          © {new Date().getFullYear()} CrewScale — Desenvolvido por Marcos Vinicius
        </p>
      </motion.div>
    </div>
  );
}
