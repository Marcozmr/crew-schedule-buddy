/**
 * SPIKE (descartável) — rota /lab/iflight.
 *
 * Responde duas perguntas no celular real, sem servidor nenhum:
 *  1. O login da LATAM (Google → Microsoft Authenticator) conclui dentro de uma WebView do app?
 *  2. Dá para pegar a escala (PDF) do iFlight de dentro dessa WebView e importar com o parser atual?
 *
 * Não troca o user-agent e não preenche nada: quem faz o login é a própria tripulante.
 * O relatório copiado não contém cookies, tokens, senhas nem o conteúdo da escala.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { InAppBrowser, ToolBarType } from '@capgo/inappbrowser';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { importPdfArrayBuffer } from '@/lib/pdf-import';
import { IFLIGHT_LAB_HOOK_SCRIPT } from './hook-script';

const IFLIGHT_URL = 'https://iflightla.ibsplc.aero/iflight-crew/web/getMainPage?companyId=LA';

type HostKind = 'google' | 'microsoft' | 'iflight' | 'outro';

function hostKind(url: string): HostKind {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h.endsWith('google.com') || h.endsWith('googleusercontent.com')) return 'google';
    if (h.includes('microsoftonline.com') || h.endsWith('live.com') || h.endsWith('microsoft.com')) return 'microsoft';
    if (h.endsWith('ibsplc.aero')) return 'iflight';
    return 'outro';
  } catch {
    return 'outro';
  }
}

/** Só origem + caminho: o relatório nunca leva parâmetros de URL do app nativo (podem ter SAML/código). */
function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url.slice(0, 80);
  }
}

type Milestones = {
  google: boolean;
  microsoft: boolean;
  voltouAoIflight: boolean;
  menuDaEscala: boolean;
  pdf: boolean;
  erro: string | null;
};

const EMPTY_MILESTONES: Milestones = {
  google: false,
  microsoft: false,
  voltouAoIflight: false,
  menuDaEscala: false,
  pdf: false,
  erro: null,
};

type CapturedPdf = { id: string; url: string; size: number; source: string; bytes: ArrayBuffer };

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function isPdf(buf: ArrayBuffer): boolean {
  const u = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
  return u.length === 4 && u[0] === 0x25 && u[1] === 0x50 && u[2] === 0x44 && u[3] === 0x46;
}

function hhmmss(): string {
  return new Date().toTimeString().slice(0, 8);
}

export default function IFlightLabPage() {
  const { user } = useAuth();
  const [log, setLog] = useState<string[]>([]);
  const [ms, setMs] = useState<Milestones>(EMPTY_MILESTONES);
  const [pdfs, setPdfs] = useState<CapturedPdf[]>([]);
  const [importMsg, setImportMsg] = useState<string>('');
  const [open, setOpen] = useState(false);
  const sawSso = useRef(false);
  const handles = useRef<PluginListenerHandle[]>([]);
  const native = Capacitor.isNativePlatform();

  const add = useCallback((line: string) => {
    setLog((prev) => [...prev.slice(-400), `${hhmmss()} ${line}`]);
  }, []);

  const addPdf = useCallback(
    (source: string, url: string, bytes: ArrayBuffer) => {
      setPdfs((prev) => {
        if (prev.some((p) => p.size === bytes.byteLength)) return prev;
        return [...prev, { id: `${Date.now()}-${prev.length}`, url, size: bytes.byteLength, source, bytes }];
      });
      setMs((m) => ({ ...m, pdf: true }));
      add(`PDF capturado (${source}) ${Math.round(bytes.byteLength / 1024)} KB ${url}`);
    },
    [add],
  );

  const inject = useCallback(() => {
    InAppBrowser.executeScript({ code: IFLIGHT_LAB_HOOK_SCRIPT }).catch(() => undefined);
  }, []);

  const onUrl = useCallback(
    (url: string) => {
      const kind = hostKind(url);
      add(`URL [${kind}] ${shortUrl(url)}`);
      if (kind === 'google') {
        sawSso.current = true;
        setMs((m) => ({ ...m, google: true }));
      } else if (kind === 'microsoft') {
        sawSso.current = true;
        setMs((m) => ({ ...m, microsoft: true }));
      } else if (kind === 'iflight' && sawSso.current) {
        setMs((m) => ({ ...m, voltouAoIflight: true }));
      }
    },
    [add],
  );

  useEffect(() => {
    if (!native) return;
    let cancelled = false;
    const reg = async () => {
      const hs = await Promise.all([
        InAppBrowser.addListener('urlChangeEvent', (e) => {
          onUrl(e.url);
          inject();
        }),
        InAppBrowser.addListener('browserPageLoaded', () => inject()),
        InAppBrowser.addListener('pageLoadError', () => add('ERRO ao carregar a página')),
        InAppBrowser.addListener('closeEvent', () => {
          add('WebView fechada');
          setOpen(false);
        }),
        InAppBrowser.addListener('consoleMessage', (e) => {
          if (e.level === 'error') add(`console.error ${String(e.message).slice(0, 160)}`);
        }),
        InAppBrowser.addListener('downloadCompleted', async (e) => {
          add(`download nativo: ${e.fileName} (${e.mimeType ?? '?'})`);
          try {
            const res = await fetch(Capacitor.convertFileSrc(e.path));
            const buf = await res.arrayBuffer();
            if (isPdf(buf)) addPdf('download', e.sourceUrl ? shortUrl(e.sourceUrl) : e.fileName, buf);
            else add('download nativo não é PDF');
          } catch (err) {
            add(`falha lendo download nativo: ${String(err)}`);
          }
        }),
        InAppBrowser.addListener('downloadFailed', (e) => add(`download falhou: ${e.error}`)),
        InAppBrowser.addListener('messageFromWebview', (e) => {
          const d = (e.detail ?? {}) as Record<string, unknown>;
          switch (d.type) {
            case 'hook':
              add(`script ativo em ${String(d.frame)}`);
              break;
            case 'net': {
              const shape = d.shape ? ` forma=${JSON.stringify(d.shape)}` : '';
              const body = Array.isArray(d.body) ? ` corpo=[${(d.body as string[]).join(',')}]` : '';
              const note = d.note ? ` (${String(d.note)})` : '';
              add(`NET ${String(d.method)} ${String(d.status)} ${String(d.ct)} ${String(d.url)}${body}${shape}${note}`);
              break;
            }
            case 'pdf':
              addPdf(String(d.source), String(d.url), base64ToArrayBuffer(String(d.base64)));
              break;
            case 'page': {
              const hits = Array.isArray(d.hits) ? (d.hits as string[]) : [];
              const iframes = Array.isArray(d.iframes) ? (d.iframes as string[]) : [];
              add(
                `TELA "${String(d.title ?? '')}" ${String(d.url)} menu=[${hits.join(' | ')}]` +
                  (iframes.length ? ` iframes=[${iframes.join(' | ')}]` : '') +
                  (d.errorHint ? ` ERRO="${String(d.errorHint)}"` : ''),
              );
              if (d.errorHint) setMs((m) => ({ ...m, erro: String(d.errorHint) }));
              if (hits.length > 0 && hostKind(`https://${String(d.frame)}`) === 'iflight') {
                setMs((m) => ({ ...m, menuDaEscala: true }));
              }
              break;
            }
            case 'open':
              add(`window.open ${String(d.url)}`);
              break;
            case 'note':
              add(`nota: ${String(d.text)} ${d.url ? String(d.url) : ''}`);
              break;
            default:
              add(`mensagem: ${JSON.stringify(d).slice(0, 200)}`);
          }
        }),
      ]);
      if (cancelled) hs.forEach((h) => h.remove());
      else handles.current = hs;
    };
    void reg();
    return () => {
      cancelled = true;
      handles.current.forEach((h) => h.remove());
      handles.current = [];
    };
  }, [native, add, addPdf, inject, onUrl]);

  const openIflight = async () => {
    sawSso.current = false;
    setMs(EMPTY_MILESTONES);
    add(`abrindo ${shortUrl(IFLIGHT_URL)}?companyId=LA (${Capacitor.getPlatform()})`);
    try {
      await InAppBrowser.openWebView({
        url: IFLIGHT_URL,
        title: 'iFlight — LATAM (teste)',
        toolbarType: ToolBarType.NAVIGATION,
        showReloadButton: true,
        isPresentAfterPageLoad: true,
        preShowScript: IFLIGHT_LAB_HOOK_SCRIPT,
        preShowScriptInjectionTime: 'documentStart',
        captureConsoleLogs: true,
        handleDownloads: true,
        openBlankTargetInWebView: true,
        isInspectable: true,
      });
      setOpen(true);
    } catch (err) {
      add(`falha ao abrir WebView: ${String(err)}`);
    }
  };

  const closeIflight = async () => {
    await InAppBrowser.close().catch(() => undefined);
    setOpen(false);
  };

  const clearSession = async () => {
    await InAppBrowser.clearAllCookies().catch(() => undefined);
    add('cookies da WebView apagados (próxima abertura pede login de novo)');
  };

  const importPdf = async (p: CapturedPdf) => {
    if (!user) {
      setImportMsg('Entre no EscalaX antes de importar.');
      return;
    }
    setImportMsg('Importando…');
    try {
      const r = await importPdfArrayBuffer(`iflight-lab-${new Date().toISOString().slice(0, 10)}.pdf`, p.bytes, user.id);
      const msg = r.error
        ? `Falhou: ${r.error}`
        : `${r.duplicate ? 'Já importado antes. ' : ''}Lidos ${r.parsedCount} eventos, gravados ${r.insertedCount}.`;
      setImportMsg(msg);
      add(`IMPORT ${msg}`);
    } catch (err) {
      setImportMsg(`Falhou: ${String(err)}`);
      add(`IMPORT falhou: ${String(err)}`);
    }
  };

  const report = () =>
    [
      'EscalaX — teste WebView iFlight',
      `plataforma: ${Capacitor.getPlatform()}`,
      `google=${ms.google} microsoft=${ms.microsoft} voltouAoIflight=${ms.voltouAoIflight} menuDaEscala=${ms.menuDaEscala} pdf=${ms.pdf} erro=${ms.erro ?? '-'}`,
      `pdfs: ${pdfs.map((p) => `${p.source} ${p.size}B ${p.url}`).join(' ; ') || '-'}`,
      '',
      ...log,
    ].join('\n');

  const copyReport = async () => {
    const text = report();
    try {
      await navigator.clipboard.writeText(text);
      add('relatório copiado');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      add('relatório copiado (modo alternativo)');
    }
  };

  const Step = ({ ok, label }: { ok: boolean; label: string }) => (
    <li className={ok ? 'text-green-600' : 'text-muted-foreground'}>
      {ok ? '✓' : '○'} {label}
    </li>
  );

  return (
    <AppLayout>
      <div className="mx-auto max-w-xl space-y-4 p-4">
        <h1 className="text-xl font-bold">Teste: iFlight dentro do app</h1>
        <p className="text-sm text-muted-foreground">
          Abre o iFlight numa tela do próprio app. Faça o login normalmente (Google e Authenticator), depois vá em
          Roster Calendar → Roster Report. Feche, volte aqui e toque em “Copiar relatório”.
        </p>

        {!native && (
          <p className="rounded-md bg-amber-100 p-3 text-sm text-amber-900">
            Esta tela só funciona no app instalado (Android ou iPhone), não no navegador.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={openIflight} disabled={!native || open}>
            Abrir iFlight
          </Button>
          <Button variant="outline" onClick={closeIflight} disabled={!native || !open}>
            Fechar
          </Button>
          <Button variant="outline" onClick={copyReport}>
            Copiar relatório
          </Button>
          <Button variant="ghost" onClick={clearSession} disabled={!native}>
            Apagar sessão
          </Button>
        </div>

        <ul className="space-y-1 text-sm">
          <Step ok={ms.google} label="Passou pelo login do Google" />
          <Step ok={ms.microsoft} label="Passou pelo login da Microsoft (Authenticator)" />
          <Step ok={ms.voltouAoIflight} label="Voltou para o iFlight depois do login" />
          <Step ok={ms.menuDaEscala} label="Menu da escala visível no iFlight" />
          <Step ok={ms.pdf} label="PDF da escala capturado" />
          {ms.erro && <li className="font-medium text-red-600">Erro na página: {ms.erro}</li>}
        </ul>

        {pdfs.length > 0 && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">PDFs capturados</p>
            {pdfs.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">
                  {Math.round(p.size / 1024)} KB · {p.source}
                </span>
                <Button size="sm" onClick={() => importPdf(p)}>
                  Importar
                </Button>
              </div>
            ))}
            {importMsg && <p className="text-sm">{importMsg}</p>}
          </div>
        )}

        <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2 text-[11px] leading-tight">
          {log.join('\n') || 'Nada ainda.'}
        </pre>
      </div>
    </AppLayout>
  );
}
