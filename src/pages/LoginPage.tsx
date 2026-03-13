import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveUser } from '@/lib/store';
import { toast } from 'sonner';

export default function LoginPage() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
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

    // Simulate auth with localStorage
    setTimeout(() => {
      const users = JSON.parse(localStorage.getItem('crewscale_users') || '{}');
      
      if (isRegister) {
        if (users[form.email]) {
          toast.error('E-mail já cadastrado');
          setLoading(false);
          return;
        }
        users[form.email] = { password: form.password, name: form.name };
        localStorage.setItem('crewscale_users', JSON.stringify(users));
        saveUser({ id: crypto.randomUUID(), name: form.name, email: form.email, airline: '', registration: '' });
        toast.success('Conta criada com sucesso!');
        navigate('/dashboard');
      } else {
        const user = users[form.email];
        if (!user || user.password !== form.password) {
          toast.error('E-mail ou senha incorretos');
          setLoading(false);
          return;
        }
        saveUser({ id: crypto.randomUUID(), name: user.name, email: form.email, airline: '', registration: '' });
        toast.success('Bem-vindo de volta!');
        navigate('/dashboard');
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - Branding */}
      <div className="hidden lg:flex flex-1 gradient-dark items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full gradient-sky"
              style={{
                width: `${100 + i * 80}px`,
                height: `${100 + i * 80}px`,
                top: `${10 + i * 12}%`,
                left: `${5 + i * 15}%`,
                opacity: 0.1 + i * 0.03,
              }}
            />
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center"
        >
          <div className="w-20 h-20 rounded-2xl gradient-sky flex items-center justify-center mx-auto mb-8 shadow-elevated">
            <Plane className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-5xl font-extrabold text-primary-foreground tracking-tight mb-4">CrewScale</h1>
          <p className="text-lg text-sidebar-foreground max-w-md">
            Gerencie sua escala de voo com inteligência. Visualize horas, folgas e voos em tempo real.
          </p>
        </motion.div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-background">
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
      </div>
    </div>
  );
}
