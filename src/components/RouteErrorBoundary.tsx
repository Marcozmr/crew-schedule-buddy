import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { reportReactBoundaryError } from "@/lib/monitoring/errorReporting";

interface Props {
  children: ReactNode;
  /** Identificação no console / UI */
  scope?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Isola falhas de renderização para não derrubar toda a árvore autenticada (tela branca).
 * Erros continuam logados no console.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const label = this.props.scope ? `:${this.props.scope}` : "";
    reportReactBoundaryError(error, {
      boundary: "route",
      scope: this.props.scope,
      componentStack: info.componentStack ?? undefined,
    });
    console.error(`[RouteErrorBoundary${label}]`, error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      return (
        <div
          role="alert"
          className="rounded-xl border border-destructive/35 bg-destructive/10 p-4 text-sm text-foreground"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="min-w-0">
              <p className="font-semibold text-destructive">
                {this.props.scope
                  ? `Erro em: ${this.props.scope}`
                  : "Algo quebrou nesta área"}
              </p>
              <p className="mt-1 break-words font-mono text-xs text-muted-foreground">
                {this.state.error.message}
              </p>
              <button
                type="button"
                className="mt-3 text-xs font-medium text-primary underline"
                onClick={() => window.location.reload()}
              >
                Recarregar página
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
