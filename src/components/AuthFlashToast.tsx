import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { consumeAuthFlash } from "@/lib/auth/authFlash";

/**
 * Consome mensagens únicas pós-redirect (callback de auth) e mostra toast em português.
 */
export function AuthFlashToast() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const k = consumeAuthFlash();
    if (!k) return;

    const messages: Record<string, { type: "success" | "error"; text: string }> = {
      email_confirmed: { type: "success", text: "Email confirmado com sucesso." },
      magic_link: { type: "success", text: "Sessão iniciada com sucesso." },
      generic: { type: "success", text: "Operação concluída." },
      session_missing: {
        type: "error",
        text: "Não foi possível iniciar sessão a partir deste link. Faça login ou solicite um novo envio.",
      },
      password_updated: { type: "success", text: "Senha atualizada com sucesso." },
    };

    const m = messages[k];
    if (!m) return;
    if (m.type === "success") toast.success(m.text);
    else toast.error(m.text);
  }, []);

  return null;
}
