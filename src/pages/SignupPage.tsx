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

export default function SignupPage() {
  const navigate = useNavigate();
  const { session, signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (session) navigate('/home', { replace: true });
  }, [session, navigate]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, name);
      setSuccess(true);
      toast.success('Conta criada! Verifique seu email para confirmar.');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  }, [name, email, password, signUp]);

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
          </div>

          {success ? (
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-2">Conta criada! ✉️</h2>
              <p className="text-white/60 text-sm mb-4">Verifique seu email para confirmar sua conta e depois faça login.</p>
              <Link to="/">
                <Button className="gradient-sky text-white">Ir para Login</Button>
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white mb-1">Criar conta</h2>
              <p className="text-white/50 mb-6 text-sm">Preencha seus dados para começar</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-white/80">Nome completo</Label>
                  <Input id="name" type="text" placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/40" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white/80">Email</Label>
                  <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/40" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white/80">Senha</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} className="h-12 pr-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/40" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full h-12 gradient-sky text-white font-semibold text-base">
                  {loading ? 'Criando...' : 'Criar conta'}
                </Button>
              </form>

              <p className="mt-4 text-center text-sm text-white/50">
                Já tem conta?{' '}
                <Link to="/" className="text-white/80 hover:text-white font-medium">Fazer login</Link>
              </p>
            </>
          )}
        </div>

        <p className="text-center mt-6 text-white/30 text-xs">
          © {new Date().getFullYear()} EscalaX. Desenvolvido por Marcos Vinicius.
        </p>
      </motion.div>
    </div>
  );
}
