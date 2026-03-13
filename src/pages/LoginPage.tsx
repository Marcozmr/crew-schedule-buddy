import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const { signIn, signUp, session } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  if (session) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!form.email || !form.password) {
      toast.error('Preencha todos os campos');
      setLoading(false);
      return;
    }

    if (isRegister && !form.name) {
      toast.error('Informe seu nome');
      setLoading(false);
      return;
    }

    try {
      if (isRegister) {
        await signUp(form.email, form.password, form.name);
        toast.success('Conta criada com sucesso! Verifique seu e-mail.');
      } else {
        await signIn(form.email, form.password);
        toast.success('Bem-vindo de volta!');
      }
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Erro na autenticação');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - Airplane Background */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <img
          src={airplaneBg}
          alt="Avião voando sobre nuvens ao pôr do sol"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 flex flex-col justify-between p-12 w-full"
        >
          <div>
            <div className="w-16 h-16 rounded-2xl gradient-sky flex items-center justify-center mb-8 shadow-elevated">
              <Plane className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-5xl font-extrabold text-white tracking-tight mb-4">CrewScale</h1>
            <p className="text-lg text-white/80 max-w-md">
              Gerencie sua escala de voo com inteligência. Visualize horas, folgas e voos em tempo real.
            </p>
          </div>
          <p className="text-white/50 text-sm">
            © {new Date().getFullYear()} CrewScale — Desenvolvido por Marcos Vinicius
          </p>
        </motion.div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 bg-background">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg gradient-sky flex items-center justify-center">
              <Plane className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">CrewScale</span>
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-2">
            {isRegister ? 'Crie sua conta' : 'Bem-vindo de volta'}
          </h2>
          <p className="text-muted-foreground mb-8">
            {isRegister ? 'Comece a gerenciar sua escala' : 'Acesse sua escala de voo'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground">Nome completo</Label>
                <Input
                  id="name"
                  placeholder="Seu nome"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="h-12"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="h-12 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-12 gradient-sky text-primary-foreground font-semibold text-base" disabled={loading}>
              {loading ? 'Carregando...' : isRegister ? 'Criar conta' : 'Entrar'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isRegister ? 'Já tem conta?' : 'Não tem conta?'}{' '}
            <button onClick={() => setIsRegister(!isRegister)} className="text-primary font-medium hover:underline">
              {isRegister ? 'Fazer login' : 'Criar conta'}
            </button>
          </p>
        </motion.div>

        <p className="lg:hidden mt-8 text-muted-foreground text-xs">
          © {new Date().getFullYear()} CrewScale — Desenvolvido por Marcos Vinicius
        </p>
      </div>
    </div>
  );
}
