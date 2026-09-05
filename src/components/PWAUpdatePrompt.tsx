/**
 * Atualização do Service Worker — nova build disponível.
 * Aplica sozinho, sem esperar clique: troca a build ativa e recarrega assim que detecta uma
 * nova versão. A sessão do usuário não é afetada — o Service Worker só troca assets estáticos
 * (JS/CSS/HTML em cache); a sessão do Supabase mora em `localStorage` (chaves `sb-*`), que o
 * reload não apaga. Depois do reload, confirma pro usuário com um toast que a atualização
 * aconteceu (e qual versão ficou ativa). Só em produção; em dev o plugin não registra SW.
 */

import { useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "@/components/ui/sonner";
import { getEscalaxBuildId } from "@/lib/build-id";

/** Marca, antes do reload, que a próxima carga deve avisar "atualizado". Sobrevive ao reload
 *  (localStorage, não sessionStorage) e é removida assim que o aviso é mostrado. */
const UPDATE_NOTICE_KEY = "escalax_update_applied_notice";

export function PWAUpdatePrompt() {
  if (import.meta.env.DEV) {
    return null;
  }

  return <PWAUpdatePromptInner />;
}

function PWAUpdatePromptInner() {
  const autoUpdateTriggered = useRef(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (import.meta.env.DEV) return;
      console.info("[EscalaX][sw] registo concluído", {
        swUrl,
        scope: registration?.scope,
        buildId: getEscalaxBuildId(),
      });
    },
    onRegisterError(error) {
      console.warn("[EscalaX][sw] falha no registo (app continua online)", error);
    },
  });

  // Nova build detectada → aplica e recarrega imediatamente, sem esperar o usuário clicar em
  // nada. `updateServiceWorker(true)` manda a SW nova assumir e recarrega a página sozinha.
  useEffect(() => {
    if (!needRefresh || autoUpdateTriggered.current) return;
    autoUpdateTriggered.current = true;
    console.info("[EscalaX][sw] nova versão detectada — atualizando automaticamente", {
      buildId: getEscalaxBuildId(),
    });
    try {
      localStorage.setItem(UPDATE_NOTICE_KEY, "1");
    } catch {
      /* localStorage indisponível (modo privado etc.) — segue sem o aviso pós-reload */
    }
    void updateServiceWorker(true);
  }, [needRefresh, updateServiceWorker]);

  // Depois do reload com a build nova: confirma pro usuário que a atualização foi aplicada.
  useEffect(() => {
    let pending = false;
    try {
      pending = localStorage.getItem(UPDATE_NOTICE_KEY) === "1";
    } catch {
      pending = false;
    }
    if (!pending) return;
    try {
      localStorage.removeItem(UPDATE_NOTICE_KEY);
    } catch {
      /* ignore */
    }
    const buildId = getEscalaxBuildId();
    console.info("[EscalaX][sw] build atualizada com sucesso", { buildId });
    toast.success("EscalaX atualizado", {
      description:
        buildId !== "unknown" ? `Nova versão instalada (${buildId}).` : "Você já está na versão mais recente.",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
