import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FlightBoardErrorProps {
  message: string;
  /** Exibido apenas em desenvolvimento (import.meta.env.DEV) */
  technicalError?: string | null;
  onRetry?: () => void;
}

export function FlightBoardError({
  message,
  technicalError,
  onRetry,
}: FlightBoardErrorProps) {
  const isDev = import.meta.env.DEV;
  const showTechnical = isDev && technicalError?.trim();

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-10 text-center">
      <AlertCircle className="mb-3 h-10 w-10 text-destructive/70" />
      <p className="text-sm font-medium text-foreground">{message}</p>
      {showTechnical && (
        <p className="mt-2 font-mono text-xs text-muted-foreground" title="Diagnóstico técnico">
          {technicalError}
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        Verifique sua conexão e tente atualizar
      </p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 gap-2"
          onClick={onRetry}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
