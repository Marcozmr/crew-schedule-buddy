/**
 * Atualização do Service Worker — nova build disponível (toast + “Atualizar agora”).
 * Só em produção; em dev o plugin não regista SW.
 */

import { useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "@/components/ui/sonner";
import { getEscalaxBuildId } from "@/lib/build-id";

export function PWAUpdatePrompt() {
  if (import.meta.env.DEV) {
    return null;
  }

  return <PWAUpdatePromptInner />;
}

function PWAUpdatePromptInner() {
  const toastShown = useRef(false);

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

  useEffect(() => {
    if (!needRefresh || toastShown.current) return;
    toastShown.current = true;
    console.info("[EscalaX][sw] nova versão disponível", { buildId: getEscalaxBuildId() });
    toast("Nova versão do EscalaX", {
      description: "Atualize para obter as últimas melhorias e correções.",
      duration: Infinity,
      action: {
        label: "Atualizar agora",
        onClick: () => {
          console.info("[EscalaX][sw] utilizador pediu atualização imediata");
          void updateServiceWorker(true);
        },
      },
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}
