/**
 * Card "iFlight — LATAM": conecta o portal pela tela de navegador do app e sincroniza com a
 * sessão salva no aparelho. Só aparece no app instalado.
 */
import { useCallback, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Check, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { importPdfArrayBuffer } from '@/lib/pdf-import';
import { connectPortal, resetPortal, STEP_LABELS, syncPortal, type PortalResult, type PortalStep } from '../portal-session';
import { LATAM_IFLIGHT } from '../providers';
import { loadPortalState, type PortalStatus } from '../session-store';

const PROVIDER = LATAM_IFLIGHT;

const STATUS_TEXT: Record<PortalStatus, string> = {
  never: 'Não conectado',
  saved: 'Sessão salva',
  expired: 'Sessão expirada',
};

const STATUS_DOT: Record<PortalStatus, string> = {
  never: 'bg-muted-foreground',
  saved: 'bg-primary',
  expired: 'bg-accent',
};

const VISIBLE_STEPS: PortalStep[] = ['conectando', 'lendo', 'salvando'];

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function DevicePortalCard({ onImported }: { onImported?: () => void }) {
  const { user } = useAuth();
  const [state, setState] = useState(() => loadPortalState(PROVIDER.id));
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<PortalStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const run = useCallback(
    async (mode: 'connect' | 'sync') => {
      if (!user) return;
      setBusy(true);
      setError(null);
      setInfo(null);
      const deps = { importPdf: (name: string, bytes: ArrayBuffer) => importPdfArrayBuffer(name, bytes, user.id) };
      let result: PortalResult =
        mode === 'sync' ? await syncPortal(PROVIDER, deps, setStep) : await connectPortal(PROVIDER, deps, setStep);
      if (result.kind === 'needs_connect') result = await connectPortal(PROVIDER, deps, setStep);

      setState(loadPortalState(PROVIDER.id));
      if (result.kind === 'imported') {
        setInfo(result.duplicate ? 'Sua escala já estava atualizada.' : `Escala atualizada: ${result.insertedCount} eventos.`);
        onImported?.();
      } else if (result.kind === 'login_required') {
        setError('Sessão expirada. Toque em Reconectar.');
      } else if (result.kind === 'error') {
        setError(result.message);
      }
      setStep(null);
      setBusy(false);
    },
    [user, onImported],
  );

  const reset = useCallback(async () => {
    if (!window.confirm('Apagar a sessão do iFlight neste aparelho? Você vai precisar entrar de novo.')) return;
    await resetPortal(PROVIDER);
    setState(loadPortalState(PROVIDER.id));
    setError(null);
    setInfo(null);
  }, []);

  if (!Capacitor.isNativePlatform()) return null;

  const connected = state.status !== 'never';
  const currentIndex = step ? VISIBLE_STEPS.indexOf(step) : -1;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{PROVIDER.title}</p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[state.status]}`} aria-hidden="true" />
            <span>{STATUS_TEXT[state.status]}</span>
          </p>
          {state.lastSyncAt && (
            <p className="text-xs text-muted-foreground">Atualizado em {formatWhen(state.lastSyncAt)}</p>
          )}
        </div>
        {connected && (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void reset()} disabled={busy}>
            Reset
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {connected ? (
          <>
            <Button onClick={() => void run('sync')} disabled={busy}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Sincronizar escala
            </Button>
            <Button variant="outline" onClick={() => void run('connect')} disabled={busy}>
              Reconectar
            </Button>
          </>
        ) : (
          <Button onClick={() => void run('connect')} disabled={busy}>
            Conectar iFlight
          </Button>
        )}
      </div>

      {busy && (
        <ol className="space-y-1 text-sm" aria-live="polite">
          {VISIBLE_STEPS.map((s, i) => (
            <li key={s} className={i <= currentIndex ? 'text-foreground' : 'text-muted-foreground'}>
              <span className="inline-flex w-5 justify-center" aria-hidden="true">
                {i < currentIndex ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : i === currentIndex ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  '○'
                )}
              </span>{' '}
              {STEP_LABELS[s]}
            </li>
          ))}
        </ol>
      )}

      {!connected && !busy && (
        <p className="text-xs text-muted-foreground">
          Você entra no iFlight aqui mesmo, com seu login da LATAM. A senha não passa pelo EscalaX; a sessão fica só
          neste aparelho.
        </p>
      )}
      {info && <p className="text-sm text-primary">{info}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
