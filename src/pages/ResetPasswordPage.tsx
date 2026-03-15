import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Eye, EyeOff, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import airplaneBg from '@/assets/airplane-bg.jpg';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      // Supabase handles session automatically from the hash
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(error.message || 'Erro ao redefinir senha');
    } else {
      setSuccess(true);
      toast.success('Senha redefinida com sucesso!');
      setTimeout(() => navigate('/dashboard'), 2000);
    }

    setLoading(false);
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
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Escalax</h1>
          </div>

          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Senha redefinida!</h2>
              <p className="text-white/60 text-sm">Redirecionando para o dashboard...</p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white mb-1">Redefinir senha</h2>
              <p className="text-white/50 mb-6 text-sm">Digite sua nova senha abaixo</p>

              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white/80">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
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

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-white/80">Confirmar nova senha</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/40"
                  />
                </div>

                <Button type="submit" className="w-full h-12 gradient-sky text-white font-semibold text-base" disabled={loading}>
                  {loading ? 'Redefinindo...' : 'Redefinir senha'}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center mt-6 text-white/30 text-xs">
          © {new Date().getFullYear()} CrewScale — Desenvolvido por Marcos Vinicius
        </p>
      </motion.div>
    </div>
  );
}
