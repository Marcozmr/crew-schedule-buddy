import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { Plane, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { formatAuthErrorForUser } from "@/lib/auth/formatAuthError";
import {
  getResendCooldownRemainingMs,
  markResendConfirmationAttempt,
  RESEND_CONFIRMATION_COOLDOWN_MS,
} from "@/lib/auth/resendCooldown";
import { checkRateLimit, getRateLimitMessage } from "@/lib/rate-limit";
import { reportAuthFlowFailure } from "@/lib/monitoring/errorReporting";
import { toast } from "sonner";

const RESEND_RATE_KEY = "resend-confirmation";

export default function VerifyEmailPage() {
  const { resendConfirmationEmail, session, emailConfirmed, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const initialEmail =
    (location.state as { email?: string } | null)?.email ?? searchParams.get("email") ?? "";

  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    if (!email.trim()) return;
    const tick = () => setCooldownLeft(Math.ceil(getResendCooldownRemainingMs(email) / 1000));
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [email]);

  const handleResend = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toast.error("Informe o email da sua conta.");
      return;
    }
    const remainMs = getResendCooldownRemainingMs(trimmed);
    if (remainMs > 0) {
      toast.error(`Aguarde ${Math.ceil(remainMs / 1000)}s antes de reenviar.`);
      return;
    }
    if (!checkRateLimit(RESEND_RATE_KEY, 5, 3_600_000)) {
      toast.error(getRateLimitMessage());
      return;
    }
    setLoading(true);
    try {
      await resendConfirmationEmail(trimmed);
      markResendConfirmationAttempt(trimmed);
      setCooldownLeft(Math.ceil(RESEND_CONFIRMATION_COOLDOWN_MS / 1000));
      toast.success("Se existir uma conta pendente, enviámos um novo email de confirmação.");
    } catch (e: unknown) {
      reportAuthFlowFailure('verify_email_resend', e);
      toast.error(formatAuthErrorForUser(e));
    } finally {
      setLoading(false);
    }
  }, [email, resendConfirmationEmail]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (session && emailConfirmed) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1f3c 40%, #1a3a5c 70%, #0a1628 100%)' }}>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 mx-4 w-full max-w-md"
      >
        <div className="rounded-2xl border border-white/10 bg-black/20 p-8 shadow-elevated backdrop-blur-md">
          <div className="mb-6 flex flex-col items-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl gradient-sky shadow-elevated">
              <Plane className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Confirme o seu email</h1>
          </div>

          <div className="mb-6 flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-white/70" />
            <p className="text-sm leading-relaxed text-white/80">
              Para aceder à aplicação, confirme o endereço de email através do link que enviámos. Verifique
              também a pasta de spam.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ve" className="text-white/80">
                Email da conta
              </Label>
              <Input
                id="ve"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="h-12 bg-white/10 text-white placeholder:text-white/40"
              />
            </div>

            <Button
              type="button"
              disabled={loading || cooldownLeft > 0}
              onClick={() => void handleResend()}
              className="h-12 w-full bg-slate-950 font-semibold text-white hover:bg-slate-800"
            >
              {loading
                ? "A enviar…"
                : cooldownLeft > 0
                  ? `Reenviar (${cooldownLeft}s)`
                  : "Reenviar email de confirmação"}
            </Button>

            <Link
              to="/login"
              className="block text-center text-sm text-white/60 underline-offset-4 hover:text-white hover:underline"
            >
              Voltar ao login
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
