import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plane, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import airplaneBg from '@/assets/airplane-bg.jpg';

export default function LoginPage() {
  const navigate = useNavigate();
  const { session, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) navigate('/dashboard', { replace: true });
  }, [session, navigate]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Preencha email e senha');
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success('Login realizado!');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  }, [email, password, signIn]);

  if (session) return null;

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
            <p className="text-sm text-white/60 mt-1">Gerencie sua escala de voo com inteligência</p>
          </div>

          <h2 className="text-xl font-bold text-white mb-1">Entrar</h2>
          <p className="text-white/50 mb-6 text-sm">Acesse com seu email e senha</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/80">Email</Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/40" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/80">Senha</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="h-12 pr-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/40" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-12 gradient-sky text-white font-semibold text-base">
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <div className="mt-4 text-center space-y-2">
            <Link to="/forgot-password" className="text-sm text-white/50 hover:text-white/80 block">Esqueci minha senha</Link>
            <p className="text-sm text-white/50">
              Não tem conta?{' '}
              <Link to="/signup" className="text-white/80 hover:text-white font-medium">Criar conta</Link>
            </p>
          </div>
        </div>

        <p className="text-center mt-6 text-white/30 text-xs">
          © {new Date().getFullYear()} EscalaX — Desenvolvido por Marcos Vinicius
        </p>
      </motion.div>
    </div>
  );
}
