import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AUTH_CALLBACK_PATH } from "@/lib/auth/authRedirect";

/**
 * Compatibilidade: links antigos apontavam para `/reset-password#...`.
 * Redireciona para `/auth/callback` preservando hash e query para processamento único.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const hasAuthPayload =
      window.location.hash.length > 1 ||
      window.location.search.includes("code=") ||
      window.location.search.includes("error=");
    if (hasAuthPayload) {
      navigate(`${AUTH_CALLBACK_PATH}${window.location.search}${window.location.hash}`, { replace: true });
      return;
    }
    navigate("/forgot-password", { replace: true });
  }, [navigate]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
