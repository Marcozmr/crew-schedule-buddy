/**
 * Exibe o Chromium remoto do worker (services/roster-automation) em tempo real e encaminha
 * toques/teclado do usuário. Substitui o WebView Android nativo: o login com Google acontece
 * de verdade num browser real no servidor (fora da política anti-WebView do Google) — aqui só
 * mostramos a tela e repassamos a interação, como um acesso remoto.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  connectRemoteSession,
  type RemoteSessionClient,
} from '@/lib/roster/latam-remote-session';

type ViewerStatus = 'connecting' | 'waiting_sso' | 'authenticated' | 'importing_report' | 'completed' | 'failed';

const STATUS_LABEL: Record<ViewerStatus, string> = {
  connecting: 'Conectando ao portal…',
  waiting_sso: 'Faça login com sua conta Google corporativa',
  authenticated: 'Login confirmado — abrindo iFlight Neo…',
  importing_report: 'Importando escala automaticamente…',
  completed: 'Escala importada com sucesso!',
  failed: 'Não foi possível concluir automaticamente',
};

const TERMINAL_STATUSES = new Set<ViewerStatus>(['completed', 'failed']);

interface RemoteBrowserViewerProps {
  open: boolean;
  runId: string | null;
  getAccessToken: () => Promise<string | null>;
  onImportComplete: () => void;
  onClose: () => void;
}

export function RemoteBrowserViewer({ open, runId, getAccessToken, onImportComplete, onClose }: RemoteBrowserViewerProps) {
  const [status, setStatus] = useState<ViewerStatus>('connecting');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [frame, setFrame] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const clientRef = useRef<RemoteSessionClient | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!open || !runId) return;
    let cancelled = false;
    completedRef.current = false;
    setStatus('connecting');
    setErrorDetail(null);
    setFrame(null);

    connectRemoteSession(runId, getAccessToken, {
      onFrame: (data) => {
        if (!cancelled) setFrame(data);
      },
      onStatus: (fsm) => {
        if (cancelled) return;
        if (fsm === 'authenticated') setStatus('authenticated');
        else if (fsm === 'importing_report') setStatus('importing_report');
        else if (fsm === 'completed') {
          setStatus('completed');
          completedRef.current = true;
          onImportComplete();
        } else if (fsm === 'failed') setStatus('failed');
        else setStatus('waiting_sso');
      },
      onClose: (reason) => {
        if (cancelled) return;
        // Servidor fecha o socket ao sair do waiting_sso — o pipeline autônomo continua sozinho;
        // se ainda não chegou a um estado terminal, mostra "importando" até o usuário fechar.
        setStatus((prev) => {
          if (completedRef.current) return prev;
          if (prev === 'connecting') {
            setErrorDetail(reason && reason !== 'closed' ? `Conexão encerrada: ${reason}` : 'Conexão encerrada antes de iniciar (verifique sessão/rede)');
            return 'failed';
          }
          return 'importing_report';
        });
      },
      onError: () => {
        if (!cancelled) setErrorDetail((prev) => prev ?? 'Erro na ligação com o navegador remoto (rede ou WebSocket bloqueado)');
      },
    })
      .then((client) => {
        if (cancelled) {
          client.close();
          return;
        }
        clientRef.current = client;
      })
      .catch((e) => {
        if (!cancelled) {
          setErrorDetail(e instanceof Error ? e.message : String(e));
          setStatus('failed');
        }
      });

    return () => {
      cancelled = true;
      clientRef.current?.close();
      clientRef.current = null;
    };
  }, [open, runId, getAccessToken, onImportComplete]);

  const handleTap = useCallback((e: React.PointerEvent<HTMLImageElement>) => {
    const client = clientRef.current;
    const img = imgRef.current;
    if (!client || !img) return;
    const rect = img.getBoundingClientRect();
    const xFraction = (e.clientX - rect.left) / rect.width;
    const yFraction = (e.clientY - rect.top) / rect.height;
    client.sendTap(xFraction, yFraction);
    // Toca na tela remota (ex.: campo de e-mail) já abre o teclado do celular, sem precisar
    // procurar a barra de texto separada embaixo.
    inputRef.current?.focus();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    const client = clientRef.current;
    if (client) {
      if (next.length > inputValue.length && next.startsWith(inputValue)) {
        client.sendText(next.slice(inputValue.length));
      } else if (next.length < inputValue.length) {
        for (let i = 0; i < inputValue.length - next.length; i++) client.sendKey('Backspace');
      } else if (next !== inputValue) {
        client.sendText(next);
      }
    }
    setInputValue(next);
  }, [inputValue]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      clientRef.current?.sendKey('Enter');
      e.preventDefault();
    }
  }, []);

  const showRemoteScreen = status === 'connecting' || status === 'waiting_sso';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        hideClose
        className="fixed inset-0 left-0 top-0 z-50 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-black p-0 shadow-none"
      >
        <DialogTitle className="sr-only">{STATUS_LABEL[status]}</DialogTitle>

        {/* Status discreto sobreposto — não ocupa espaço da tela remota */}
        <div className="absolute left-2 top-2 z-10 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur-sm">
          {!TERMINAL_STATUSES.has(status) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {STATUS_LABEL[status]}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-2 text-white backdrop-blur-sm"
        >
          <X className="w-4 h-4" />
        </button>

        {showRemoteScreen && (
          <div className="relative flex-1 overflow-hidden bg-black">
            {frame ? (
              <img
                ref={imgRef}
                src={`data:image/jpeg;base64,${frame}`}
                alt="Portal LATAM (sessão remota)"
                className="h-full w-full select-none object-contain"
                style={{ touchAction: 'pinch-zoom' }}
                onPointerDown={handleTap}
                draggable={false}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-white/60" />
              </div>
            )}
          </div>
        )}

        {status === 'waiting_sso' && (
          <input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            aria-label="Entrada de texto para a tela remota"
            className="absolute h-px w-px opacity-0"
          />
        )}

        {!showRemoteScreen && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            {status === 'completed' ? (
              <p className="text-sm text-white/80">Sua escala foi importada automaticamente.</p>
            ) : status === 'failed' ? (
              <>
                <p className="text-sm text-white/80">
                  Tente novamente ou use a importação manual do CrewRosterReport.
                </p>
                {errorDetail && (
                  <p className="text-xs text-destructive font-mono break-all whitespace-pre-wrap max-w-sm">{errorDetail}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-white/80">
                Aguarde — o restante da importação acontece automaticamente, sem mais ações suas.
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-white/60 underline underline-offset-2 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Fechar
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
