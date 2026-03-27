import { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  isRecoverableLoadFailureMessage,
  performStaleAssetRecovery,
} from '@/lib/app-recovery/appRecoveryManager';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

function summarizeStack(stack: string | null | undefined, maxLen = 1200): string {
  if (!stack?.trim()) return '(sem stack)';
  const t = stack.trim().replace(/\s+/g, ' ');
  return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
      componentStack: null,
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[EscalaX] AppErrorBoundary — erro:', err);
    console.error('[EscalaX] AppErrorBoundary — componentStack:\n', info.componentStack);
    this.setState({
      error: err,
      componentStack: info.componentStack ?? null,
    });
  }

  private copyDiagnostic = (): void => {
    const { error, componentStack } = this.state;
    const text = [
      `message: ${error?.message ?? '(desconhecido)'}`,
      `name: ${error?.name ?? ''}`,
      `stack: ${error?.stack ?? ''}`,
      `componentStack: ${componentStack ?? ''}`,
      `href: ${typeof window !== 'undefined' ? window.location.href : ''}`,
    ].join('\n\n');
    void navigator.clipboard.writeText(text).catch(() => {
      console.error('[EscalaX] Não foi possível copiar para a área de transferência.');
    });
  };

  render(): ReactNode {
    const { error, componentStack } = this.state;
    if (error) {
      const stackShort = summarizeStack(componentStack);
      const looksLikeStaleBuild = isRecoverableLoadFailureMessage(error.message);
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
          <p className="mb-2 text-center text-lg font-semibold text-foreground">Ocorreu um erro ao carregar o EscalaX</p>
          {looksLikeStaleBuild && (
            <p className="mb-4 max-w-md text-center text-sm text-muted-foreground">
              Pode ser uma atualização em curso. Tente atualizar a aplicação — a sua sessão será mantida.
            </p>
          )}
          <div className="mb-4 w-full max-w-lg rounded-lg border border-border bg-muted/40 p-4 text-left text-sm text-foreground">
            <p className="mb-2 font-mono text-xs font-medium text-destructive break-words">{error.message}</p>
            <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">{stackShort}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {looksLikeStaleBuild && (
              <button
                type="button"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                onClick={() => {
                  void performStaleAssetRecovery().then(() => window.location.reload());
                }}
              >
                Atualizar aplicação
              </button>
            )}
            <button
              type="button"
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground"
              onClick={this.copyDiagnostic}
            >
              Copiar diagnóstico
            </button>
            <button
              type="button"
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground"
              onClick={() => window.location.reload()}
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
