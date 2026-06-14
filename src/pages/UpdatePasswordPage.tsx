import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plane, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatAuthErrorForUser } from "@/lib/auth/formatAuthError";
import {
  PASSWORD_MIN_LENGTH,
  validateNewPasswordPair,
  type PasswordFieldErrors,
} from "@/lib/auth/updatePasswordValidation";
import { PasswordStrengthHints } from "@/components/auth/PasswordStrengthHints";
import { emailDomainOnly, logAuthAuditEvent } from "@/lib/auth/authAudit";
import { reportAuthFlowFailure } from "@/lib/monitoring/errorReporting";
import { toast } from "sonner";

/**
 * Nova senha após link de recuperação (sessão já estabelecida em `/auth/callback`).
 */
export default function UpdatePasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sessionOk, setSessionOk] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<PasswordFieldErrors>({});

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      setSessionOk(!!data.session);
      setChecking(false);
    })();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const errs = validateNewPasswordPair(password, confirmPassword);
      setFieldErrors(errs);
      if (errs.password || errs.confirmPassword) return;

      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password: password.trim() });
      setLoading(false);

      if (error) {
        reportAuthFlowFailure("update_password", error);
        toast.error(formatAuthErrorForUser(error));
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      logAuthAuditEvent("password_reset_completed", {
        domain: emailDomainOnly(userData.user?.email ?? undefined),
      });

      setSuccess(true);
      toast.success("Senha atualizada com sucesso.");
      window.setTimeout(() => {
        navigate("/home", { replace: true });
      }, 1200);
    },
    [password, confirmPassword, navigate],
  );

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!sessionOk) {
    return (
      <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg">
          <h1 className="text-xl font-semibold text-foreground">Sessão inválida</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Não foi possível confirmar a recuperação de senha. O link pode ter expirado ou já foi utilizado.
          </p>
          <div className="mt-8 flex flex-col gap-2 sm:flex-row">
            <Button asChild className="w-full sm:flex-1">
              <Link to="/forgot-password">Solicitar novo link</Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:flex-1">
              <Link to="/login">Ir para o login</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1f3c 40%, #1a3a5c 70%, #0a1628 100%)' }}>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 mx-4 w-full max-w-md"
      >
        <div className="rounded-2xl border border-white/10 bg-black/20 p-8 shadow-elevated backdrop-blur-md">
          <div className="mb-8 flex flex-col items-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl gradient-sky shadow-elevated">
              <Plane className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">EscalaX</h1>
          </div>

          {success ? (
            <div className="text-center">
              <h2 className="text-xl font-bold text-white">Senha atualizada</h2>
              <p className="mt-2 text-sm text-white/60">A redirecionar…</p>
            </div>
          ) : (
            <>
              <h2 className="mb-1 text-xl font-bold text-white">Definir nova senha</h2>
              <p className="mb-2 text-sm text-white/50">
                Mínimo {PASSWORD_MIN_LENGTH} caracteres, com maiúsculas, minúsculas, número e símbolo.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="np" className="text-white/80">
                    Nova senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="np"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setFieldErrors((f) => ({ ...f, password: undefined }));
                      }}
                      className="h-12 bg-white/10 pr-10 text-white placeholder:text-white/40 focus:border-white/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.password ? (
                    <p className="text-xs text-red-300">{fieldErrors.password}</p>
                  ) : null}
                  <PasswordStrengthHints password={password} className="mt-2 space-y-1 text-xs text-white/50" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="npc" className="text-white/80">
                    Confirmar senha
                  </Label>
                  <Input
                    id="npc"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setFieldErrors((f) => ({ ...f, confirmPassword: undefined }));
                    }}
                    className="h-12 bg-white/10 text-white placeholder:text-white/40 focus:border-white/40"
                  />
                  {fieldErrors.confirmPassword ? (
                    <p className="text-xs text-red-300">{fieldErrors.confirmPassword}</p>
                  ) : null}
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full bg-slate-950 text-base font-semibold text-white hover:bg-slate-800"
                >
                  {loading ? "A guardar…" : "Guardar nova senha"}
                </Button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
