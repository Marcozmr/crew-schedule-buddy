/**
 * Atalho HTTP leve para sincronizações repetidas: busca o CrewRosterReport direto via fetch
 * autenticado por cookie, sem abrir Chromium. Só ativa quando `LATAM_LIGHTWEIGHT_PDF_URL` está
 * configurada (descoberta inspecionando `step_logs` de uma execução real — ver plano). Nunca
 * lança erro: qualquer falha retorna `null` e quem chama cai automaticamente no fluxo completo
 * de navegador (services/roster-automation/src/providers/latam/latamAutomation.ts, runSyncFlow).
 */
import fs from 'node:fs/promises';
import { config } from '../../config.js';

export type PipelineLogFn = (entry: Record<string, unknown>) => Promise<void>;

type CookieEntry = { name: string; value: string; domain: string; path: string };
type StorageStateObj = { cookies: CookieEntry[]; origins: unknown[] };

function isStorageStateObj(v: unknown): v is StorageStateObj {
  return typeof v === 'object' && v !== null && Array.isArray((v as StorageStateObj).cookies);
}

async function loadCookies(storageStateArg: string | StorageStateObj): Promise<CookieEntry[]> {
  if (isStorageStateObj(storageStateArg)) return storageStateArg.cookies;
  const raw = await fs.readFile(storageStateArg, 'utf-8');
  const parsed = JSON.parse(raw) as StorageStateObj;
  return parsed.cookies ?? [];
}

/** Domínios relevantes para o CrewRosterReport — mesmos usados pela extensão de captura de sessão. */
const RELEVANT_DOMAINS = /iflightla\.ibsplc\.aero|portal\.latam\.com/i;

function buildCookieHeader(cookies: CookieEntry[]): string {
  return cookies
    .filter((c) => RELEVANT_DOMAINS.test(c.domain))
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

function buildUrl(targetMonth?: string): string {
  const base = config.latamLightweightPdfUrl();
  const template = config.latamLightweightPdfQueryTemplate();
  if (!template) return base;
  const query = template.replace('{YYYY-MM}', targetMonth ?? '');
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${query}`;
}

function filenameFromUrl(u: string): string {
  try {
    const last = new URL(u).pathname.split('/').pop() || 'report.pdf';
    return last.includes('.') ? last : `CrewRosterReport-${Date.now()}.pdf`;
  } catch {
    return `CrewRosterReport-${Date.now()}.pdf`;
  }
}

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Tenta buscar o PDF direto via HTTP, reaproveitando os cookies da sessão salva. Retorna `null`
 * (nunca lança) se o atalho estiver desligado, mal configurado, ou a requisição falhar por
 * qualquer motivo (sessão expirada, endpoint mudou, proteção anti-bot) — o chamador deve cair
 * no fluxo completo de navegador nesse caso.
 */
export async function tryLightweightPdfFetch(params: {
  storageStateArg: string | StorageStateObj;
  appendLog: PipelineLogFn;
  targetMonth?: string;
}): Promise<{ buffer: Buffer; fileName: string } | null> {
  const { storageStateArg, appendLog, targetMonth } = params;

  if (!config.latamLightweightFastPathEnabled() || !config.latamLightweightPdfUrl()) {
    return null;
  }

  const url = buildUrl(targetMonth);
  await appendLog({ step: 'lightweight_fetch_attempt', url: url.slice(0, 500), targetMonth: targetMonth ?? null });

  try {
    const cookies = await loadCookies(storageStateArg);
    const cookieHeader = buildCookieHeader(cookies);
    if (!cookieHeader) {
      await appendLog({ step: 'lightweight_fetch_result', ok: false, reason: 'sem cookies relevantes na sessão salva' });
      return null;
    }

    const res = await fetch(url, {
      headers: { Cookie: cookieHeader, 'User-Agent': CHROME_UA, Accept: 'application/pdf' },
    });
    const contentType = res.headers.get('content-type') ?? '';

    if (!res.ok || !contentType.toLowerCase().includes('application/pdf')) {
      await appendLog({
        step: 'lightweight_fetch_result',
        ok: false,
        status: res.status,
        contentType,
        reason: 'resposta não é PDF — provável sessão expirada ou endpoint mudou',
      });
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    await appendLog({ step: 'lightweight_fetch_result', ok: true, bytes: buffer.length });
    return { buffer, fileName: filenameFromUrl(url) };
  } catch (e) {
    await appendLog({
      step: 'lightweight_fetch_result',
      ok: false,
      reason: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}
