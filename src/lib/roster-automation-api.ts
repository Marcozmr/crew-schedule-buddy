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

export async function postLatamConnect(getAccessToken: () => Promise<string | null>): Promise<{
  sessionId: string;
  runId: string;
}> {
  const b = baseUrl();
  if (!b) throw new Error('Automação não configurada');
  const res = await fetch(`${b}/v1/latam/connect`, {
    method: 'POST',
    headers: await authHeader(getAccessToken),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `Erro ${res.status}`);
  }
  return res.json() as Promise<{ sessionId: string; runId: string }>;
}

export async function postLatamSync(
  getAccessToken: () => Promise<string | null>,
  sessionId: string,
): Promise<{ sessionId: string; runId: string }> {
  const b = baseUrl();
  if (!b) throw new Error('Automação não configurada');
  const res = await fetch(`${b}/v1/latam/sync`, {
    method: 'POST',
    headers: await authHeader(getAccessToken),
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `Erro ${res.status}`);
  }
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
  if (!b) throw new Error('Automação não configurada');
  const res = await fetch(`${b}/v1/latam/session/${encodeURIComponent(sessionId)}`, {
    headers: await authHeader(getAccessToken),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `Erro ${res.status}`);
  }
  return res.json() as Promise<{ session: Record<string, unknown>; recentRuns: Record<string, unknown>[] }>;
}

/** Rótulos em português para os estados persistidos pelo worker (UI secundária / diagnóstico). */
export function automationStatusLabelPt(status: string | undefined): string {
  const map: Record<string, string> = {
    disconnected: 'Desligado',
    portal_connecting: 'Conexão em andamento',
    portal_connected: 'Portal conectado',
    iflight_detected: 'Buscando sua escala mais recente',
    roster_downloading: 'Buscando sua escala mais recente',
    roster_importing: 'Importando escala',
    roster_connected: 'Escala ativada',
    reconnect_required: 'É necessário conectar novamente ao portal',
    error: 'Não foi possível concluir automaticamente',
  };
  return map[status ?? ''] ?? status ?? '—';
}
