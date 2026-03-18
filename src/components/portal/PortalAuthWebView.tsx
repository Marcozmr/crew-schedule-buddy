import { useEffect, useRef, useState } from 'react';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PortalAuthRequest, PortalSessionSnapshot } from '@/lib/portal/types';
import {
  createPortalSessionSnapshot,
  detectRedirect,
  openPortalLogin,
  storePortalSession,
} from '@/lib/portal/webview-connector';

interface PortalAuthWebViewProps {
  open: boolean;
  authRequest: PortalAuthRequest | null;
  onOpenChange: (open: boolean) => void;
  onAuthenticated: (snapshot: PortalSessionSnapshot) => Promise<void>;
}

export function PortalAuthWebView({
  open,
  authRequest,
  onOpenChange,
  onAuthenticated,
}: PortalAuthWebViewProps) {
  const popupRef = useRef<Window | null>(null);
  const visitedLoginDomainRef = useRef(false);
  const authenticatingRef = useRef(false);
  const [opening, setOpening] = useState(false);
  const [loginStarted, setLoginStarted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [observedHost, setObservedHost] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setOpening(false);
      setLoginStarted(false);
      setConfirming(false);
      setObservedHost(null);
      visitedLoginDomainRef.current = false;
      authenticatingRef.current = false;
      popupRef.current = null;
      return;
    }

    if (authRequest && !loginStarted) {
      void handleOpenLogin();
    }
  }, [authRequest, loginStarted, open]);

  useEffect(() => {
    if (!open || !authRequest || !loginStarted) return;

    const intervalId = window.setInterval(() => {
      const popup = popupRef.current;
      if (!popup) return;

      if (popup.closed) {
        window.clearInterval(intervalId);
        popupRef.current = null;
        return;
      }

      try {
        const currentUrl = popup.location.href;
        const detection = detectRedirect({
          url: currentUrl,
          authRequest,
          hasVisitedLoginDomain: visitedLoginDomainRef.current,
        });

        visitedLoginDomainRef.current = detection.hasVisitedLoginDomain;
        if (detection.currentHost) {
          setObservedHost(detection.currentHost);
        }

        if (detection.completed && !authenticatingRef.current) {
          authenticatingRef.current = true;
          const snapshot = storePortalSession(createPortalSessionSnapshot(authRequest, currentUrl));
          popup.close();
          void onAuthenticated(snapshot).finally(() => {
            onOpenChange(false);
          });
        }
      } catch {
        // Cross-origin navigation is expected while the portal and SSO pages are open.
      }
    }, 800);

    return () => window.clearInterval(intervalId);
  }, [authRequest, loginStarted, onAuthenticated, onOpenChange, open]);

  const handleOpenLogin = async () => {
    if (!authRequest) return;

    setOpening(true);
    try {
      popupRef.current = openPortalLogin(authRequest);
      setLoginStarted(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível abrir o login corporativo.');
    } finally {
      setOpening(false);
    }
  };

  const handleConfirmConnection = async () => {
    if (!authRequest) return;

    setConfirming(true);
    try {
      const snapshot = storePortalSession(createPortalSessionSnapshot(authRequest, popupRef.current?.location?.href ?? null));
      await onAuthenticated(snapshot);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível concluir a conexão do portal.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>Login corporativo do portal</DialogTitle>
            <Badge variant="secondary">SSO corporativo</Badge>
          </div>
          <DialogDescription>
            O acesso começa no portal oficial e pode redirecionar automaticamente para o SSO Microsoft. O EscalaX não captura senha nem credenciais.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-background/60 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Sessão autenticada protegida</p>
                <p className="text-sm text-muted-foreground break-words">
                  Faça o login normalmente no portal oficial, incluindo MFA se necessário. Quando o fluxo voltar ao portal autenticado, a conexão pode ser concluída.
                </p>
              </div>
            </div>
          </div>

          {authRequest && (
            <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-2">
              <p className="text-xs text-muted-foreground">Entrada oficial</p>
              <p className="text-sm font-medium text-foreground break-all">{authRequest.loginUrl}</p>
              <p className="text-xs text-muted-foreground break-words">{authRequest.successHint}</p>
              {observedHost && (
                <p className="text-xs text-foreground break-words">Host detectado: {observedHost}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-3 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={() => void handleOpenLogin()} disabled={opening} className="w-full sm:w-auto">
            <ExternalLink className="w-4 h-4 mr-2" />
            {opening ? 'Abrindo...' : loginStarted ? 'Abrir novamente' : 'Abrir portal oficial'}
          </Button>
          <Button type="button" onClick={() => void handleConfirmConnection()} disabled={!loginStarted || confirming} className="w-full sm:w-auto">
            {confirming ? 'Conectando...' : 'Concluir conexão'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
