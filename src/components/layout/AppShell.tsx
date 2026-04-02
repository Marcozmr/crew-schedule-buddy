import type { ReactNode } from "react";

/**
 * Shell global: viewport inteira com fundo do tema (cinza no light).
 * Sem painel branco central nem max-width — largura total; cards ficam nas páginas.
 * Apenas apresentação.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="escalax-app-shell flex min-h-dvh min-h-svh w-full min-w-0 flex-1 flex-col bg-background">
      {children}
    </div>
  );
}
