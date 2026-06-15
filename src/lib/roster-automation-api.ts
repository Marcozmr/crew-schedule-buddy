/**
 * Cliente HTTP para o serviço Node `services/roster-automation` (Playwright).
 * O URL base vem de VITE_ROSTER_AUTOMATION_URL; sem ele, a UI oculta a opção de automação.
 */

const baseUrl = (): string | undefined => {
  const u = import.meta.env.VITE_ROSTER_AUTOMATION_URL?.trim();
  return u || undefined;
};

export function isRosterAutomationConfigured(): boolean {
  return Boolean(baseUrl());
}

async function authHeader(getAccessToken: () => Promise<string | null>): Promise<HeadersInit> {
  const t = await getAccessToken();
  if (!t) throw new Error('Sessão expirada — inicie sessão novamente.');
  return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
}

/**
 * Fetch com erros detalhados: distingue falha de rede/CORS (sem resposta) de erro HTTP.
 * Inclui URL chamada, status e body na mensagem de erro para facilitar diagnóstico.
 */
async function fetchWorker(url: string, options: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Sem resposta do worker — possível erro de CORS ou worker offline.\nURL: ${url}\nDetalhe: ${detail}`,
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let detail = body;
    try {
      const j = JSON.parse(body) as { error?: string };
      if (j.error) detail = j.error;
    } catch {
      // body não é JSON — usa texto puro
    }
    throw new Error(`Worker retornou ${res.status} em ${url}${detail ? `\n${detail}` : ''}`);
  }
  return res;
}

export async function postLatamConnect(getAccessToken: () => Promise<string | null>): Promise<{
  sessionId: string;
  runId: string;
}> {
  const b = baseUrl();
  if (!b) throw new Error('Automação não configurada — VITE_ROSTER_AUTOMATION_URL não definido');
  const url = `${b}/v1/latam/connect`;
  const res = await fetchWorker(url, {
    method: 'POST',
    headers: await authHeader(getAccessToken),
  });
  return res.json() as Promise<{ sessionId: string; runId: string }>;
}

export async function postLatamSync(
  getAccessToken: () => Promise<string | null>,
  sessionId: string,
): Promise<{ sessionId: string; runId: string }> {
  const b = baseUrl();
  if (!b) throw new Error('Automação não configurada — VITE_ROSTER_AUTOMATION_URL não definido');
  const url = `${b}/v1/latam/sync`;
  const res = await fetchWorker(url, {
    method: 'POST',
    headers: await authHeader(getAccessToken),
    body: JSON.stringify({ sessionId }),
  });
  return res.json() as Promise<{ sessionId: string; runId: string }>;
}

export async function getLatamSession(
  getAccessToken: () => Promise<string | null>,
  sessionId: string,
): Promise<{
  session: Record<string, unknown>;
  recentRuns: Record<string, unknown>[];
}> {
  const b = baseUrl();
  if (!b) throw new Error('Automação não configurada — VITE_ROSTER_AUTOMATION_URL não definido');
  const url = `${b}/v1/latam/session/${encodeURIComponent(sessionId)}`;
  const res = await fetchWorker(url, { headers: await authHeader(getAccessToken) });
  return res.json() as Promise<{ session: Record<string, unknown>; recentRuns: Record<string, unknown>[] }>;
}

/** Rótulos em português para os estados persistidos pelo worker (UI secundária / diagnóstico). */
export function automationStatusLabelPt(status: string | undefined): string {
  const map: Record<string, string> = {
    disconnected: 'Desconectado',
    portal_connecting: 'Aguardando login LATAM',
    portal_connected: 'Abrindo iFlight Neo',
    iflight_detected: 'iFlight Neo carregado',
    roster_downloading: 'Baixando escala',
    roster_importing: 'Importando escala',
    roster_connected: 'Concluído',
    reconnect_required: 'É necessário conectar novamente ao portal',
    error: 'Não foi possível concluir automaticamente',
  };
  return map[status ?? ''] ?? status ?? '—';
}
