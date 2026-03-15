import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { lovable } from '@/integrations/lovable/index';
import { toast } from 'sonner';
import airplaneBg from '@/assets/airplane-bg.jpg';

const GOOGLE_AUTO_LOGIN_PARAM = 'google_auth_start';
const PUBLISHED_APP_ORIGIN = 'https://crew-schedule-buddy.lovable.app';

const isInIframe = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

const isPreviewHost = () => window.location.hostname.includes('id-preview--');

const buildStandaloneLoginUrl = () => {
  const targetUrl = new URL(`${PUBLISHED_APP_ORIGIN}/`);
  targetUrl.searchParams.set(GOOGLE_AUTO_LOGIN_PARAM, '1');
  return targetUrl.toString();
};

const getRedirectOrigin = () => {
  if (isPreviewHost()) return PUBLISHED_APP_ORIGIN;
  return window.location.origin;
};

const goToStandaloneApp = () => {
  const standaloneUrl = buildStandaloneLoginUrl();

  try {
    if (window.top && window.top !== window.self) {
      window.top.location.href = standaloneUrl;
      return;
    }
  } catch {
    // continue with fallback methods
  }

  const anchor = document.createElement('a');
  anchor.href = standaloneUrl;
  anchor.target = '_top';
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  window.location.href = standaloneUrl;
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

  const startGoogleOAuth = useCallback(async () => {
    const { error } = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: getRedirectOrigin(),
      extraParams: {
        prompt: 'consent',
        access_type: 'offline',
        include_granted_scopes: 'true',
        scopes: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
      },
    });

    if (error) {
      const message = (error as Error).message;
      toast.error('Erro ao conectar com Google: ' + message);
    }
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    setGoogleLoading(true);

    try {
      if (isInIframe() || isPreviewHost()) {
        goToStandaloneApp();
        return;
      }

      await startGoogleOAuth();
    } catch {
      toast.error('Erro ao conectar com Google');
    } finally {
      setGoogleLoading(false);
    }
  }, [startGoogleOAuth]);

  useEffect(() => {
    if (session) {
      navigate('/dashboard', { replace: true });
    }
  }, [session, navigate]);

  useEffect(() => {
    if (session || isInIframe()) return;

    const url = new URL(window.location.href);
    const shouldAutoStart = url.searchParams.get(GOOGLE_AUTO_LOGIN_PARAM) === '1';

    if (!shouldAutoStart) return;

    url.searchParams.delete(GOOGLE_AUTO_LOGIN_PARAM);
    const updatedSearch = url.searchParams.toString();
    const nextUrl = `${url.pathname}${updatedSearch ? `?${updatedSearch}` : ''}${url.hash}`;
    window.history.replaceState({}, '', nextUrl);

    void startGoogleOAuth();
  }, [session, startGoogleOAuth]);

  if (session) return null;

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
            <h1 className="text-3xl font-extrabold text-white tracking-tight">EscalaX</h1>
            <p className="text-sm text-white/60 mt-1">Gerencie sua escala de voo com inteligência</p>
          </div>

          <h2 className="text-xl font-bold text-white mb-1">Bem-vindo</h2>
          <p className="text-white/50 mb-8 text-sm">Acesse com sua conta Google corporativa</p>

          <Button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            disabled={googleLoading}
            className="w-full h-14 bg-white hover:bg-white/90 text-gray-800 font-semibold text-base rounded-xl shadow-lg transition-all"
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {googleLoading ? 'Conectando...' : 'Entrar com Google'}
          </Button>

          <p className="mt-6 text-center text-xs text-white/40">
            Use seu e-mail corporativo para acessar sua escala automaticamente
          </p>
        </div>

        <p className="text-center mt-6 text-white/30 text-xs">
          © {new Date().getFullYear()} Escalax — Desenvolvido por Marcos Vinicius
        </p>
      </motion.div>
    </div>
  );
}
