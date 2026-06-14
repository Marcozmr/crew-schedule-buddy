import { useCallback, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Plane, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';
import { formatAuthErrorForUser } from '@/lib/auth/formatAuthError';
import { evaluatePasswordStrength } from '@/lib/auth/passwordPolicy';
import { PasswordStrengthHints } from '@/components/auth/PasswordStrengthHints';
import { toast } from 'sonner';
import { checkRateLimit, getRateLimitMessage } from '@/lib/rate-limit';
import { reportAuthFlowFailure } from '@/lib/monitoring/errorReporting';

const AuthLoading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

export default function SignupPage() {
  const { session, signUp, loading: authLoading, emailConfirmed } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      toast.error('Preencha todos os campos');
      return;
    }
    const strength = evaluatePasswordStrength(password);
    if (!strength.valid) {
      toast.error(strength.primaryError ?? 'A senha não cumpre os requisitos.');
      return;
    }
    if (!checkRateLimit('signup', 5, 120_000)) {
      toast.error(getRateLimitMessage());
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, name);
      setSuccess(true);
      toast.success('Conta criada! Verifique o seu email para confirmar.');
    } catch (err: unknown) {
      reportAuthFlowFailure('signup', err);
      toast.error(formatAuthErrorForUser(err));
    } finally {
      setLoading(false);
    }
  }, [name, email, password, signUp]);

  if (authLoading) return <AuthLoading />;
  if (session && emailConfirmed) return <Navigate to="/home" replace />;
  if (session && !emailConfirmed) {
    return <Navigate to="/verify-email" replace state={{ email: session.user?.email ?? undefined }} />;
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1f3c 40%, #1a3a5c 70%, #0a1628 100%)' }}>

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
              <p className="text-white/60 text-sm mb-4">Verifique o seu email para confirmar a conta e depois faça login.</p>
              <Link to="/verify-email" state={{ email: email.trim().toLowerCase() }}>
                <Button variant="outline" className="mb-2 border-white/20 text-white hover:bg-white/10">Reenviar ou ajuda com o email</Button>
              </Link>
              <Link to="/">
                <Button className="gradient-sky text-white w-full mt-2">Ir para login</Button>
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white mb-1">Criar conta</h2>
              <p className="text-white/50 mb-6 text-sm">Preencha os seus dados para começar</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-white/80">Nome completo</Label>
                  <Input id="name" type="text" placeholder="O seu nome" value={name} onChange={e => setName(e.target.value)} className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/40" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white/80">Email</Label>
                  <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/40" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white/80">Senha</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Senha forte" value={password} onChange={e => setPassword(e.target.value)} className="h-12 pr-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/40" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <PasswordStrengthHints password={password} />
                </div>

                <Button type="submit" disabled={loading} className="w-full h-12 gradient-sky text-white font-semibold text-base">
                  {loading ? 'A criar…' : 'Criar conta'}
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
