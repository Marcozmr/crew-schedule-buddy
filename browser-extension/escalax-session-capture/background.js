/**
 * Background service worker da extensão EscalaX — Sessão iFlight.
 *
 * Responsabilidades:
 *  - Obter o JWT do utilizador a partir da aba do EscalaX (via content script).
 *  - Capturar cookies APENAS de portal.latam.com e iflightla.ibsplc.aero.
 *  - Enviar os cookies + JWT para POST /v1/latam/session/import no worker.
 *  - Nunca registar valores de cookies em logs.
 */

const WORKER_URL_KEY = 'worker_url';
const DEFAULT_WORKER_URL = 'https://escalax-roster-worker.onrender.com';

const ALLOWED_DOMAINS = [
  { url: 'https://portal.latam.com/', domain: '.portal.latam.com' },
  { url: 'https://iflightla.ibsplc.aero/', domain: '.iflightla.ibsplc.aero' },
];

async function getWorkerUrl() {
  return new Promise((resolve) => {
    chrome.storage.local.get([WORKER_URL_KEY], (result) => {
      resolve(result[WORKER_URL_KEY] ?? DEFAULT_WORKER_URL);
    });
  });
}

/**
 * Procura uma aba do EscalaX aberta e pede o access_token via content script.
 * Retorna null se o utilizador não estiver autenticado ou sem aba do EscalaX aberta.
 */
async function getAuthToken() {
  const tabs = await chrome.tabs.query({ url: 'https://www.escalax.app.br/*' });
  if (tabs.length === 0) return null;

  const tabId = tabs[0].id;
  if (tabId === undefined) return null;

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'GET_AUTH_TOKEN' }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response?.token ?? null);
    });
  });
}

/**
 * Captura cookies APENAS dos domínios permitidos.
 * Filtra pelo domain no lado do cliente antes de enviar (o servidor re-valida).
 */
async function captureAllowedCookies() {
  const allCookies = [];

  for (const { url } of ALLOWED_DOMAINS) {
    const cookies = await chrome.cookies.getAll({ url });
    allCookies.push(...cookies);
  }

  // Filtra para garantir que apenas domínios permitidos passam
  const allowedSuffixes = ALLOWED_DOMAINS.map((d) => d.domain.replace(/^\./, ''));
  const filtered = allCookies.filter((c) => {
    const clean = c.domain.replace(/^\./, '');
    return allowedSuffixes.some((suffix) => clean === suffix || clean.endsWith('.' + suffix));
  });

  return filtered.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    expirationDate: c.expirationDate,
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite,
  }));
}

/**
 * Envia cookies + JWT para o worker.
 * Retorna { ok: true, sessionId, runId } ou lança erro.
 */
async function importSession(authToken, cookies) {
  const workerUrl = await getWorkerUrl();
  const endpoint = `${workerUrl}/v1/latam/session/import`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ cookies }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let detail = body;
    try {
      const j = JSON.parse(body);
      if (j.error) detail = j.error;
    } catch { /* ignore */ }
    throw new Error(`Worker retornou ${res.status}: ${detail}`);
  }

  return res.json();
}

/**
 * Consulta o estado atual da sessão LATAM do utilizador.
 */
async function getSessionStatus(authToken) {
  const workerUrl = await getWorkerUrl();
  const res = await fetch(`${workerUrl}/v1/latam/session/status`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) throw new Error(`Worker retornou ${res.status}`);
  return res.json();
}

// ── Mensagens vindas do popup ──────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_STATUS') {
    (async () => {
      try {
        const authToken = await getAuthToken();
        if (!authToken) {
          sendResponse({ ok: false, reason: 'no_auth', status: 'disconnected' });
          return;
        }
        const status = await getSessionStatus(authToken);
        sendResponse({ ok: true, ...status });
      } catch (e) {
        sendResponse({ ok: false, reason: 'error', error: e.message });
      }
    })();
    return true;
  }

  if (msg.type === 'IMPORT_SESSION') {
    (async () => {
      try {
        const authToken = await getAuthToken();
        if (!authToken) {
          sendResponse({ ok: false, reason: 'no_auth' });
          return;
        }

        const cookies = await captureAllowedCookies();
        if (cookies.length === 0) {
          sendResponse({ ok: false, reason: 'no_cookies' });
          return;
        }

        const result = await importSession(authToken, cookies);
        sendResponse({ ok: true, ...result });
      } catch (e) {
        sendResponse({ ok: false, reason: 'error', error: e.message });
      }
    })();
    return true;
  }

  if (msg.type === 'REVOKE_SESSION') {
    (async () => {
      try {
        const authToken = await getAuthToken();
        if (!authToken) {
          sendResponse({ ok: false, reason: 'no_auth' });
          return;
        }
        const workerUrl = await getWorkerUrl();
        const res = await fetch(`${workerUrl}/v1/latam/session`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          sendResponse({ ok: false, error: `Worker retornou ${res.status}: ${body}` });
          return;
        }
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg.type === 'CHECK_TAB') {
    (async () => {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = activeTab?.url ?? '';
        const onAllowedDomain =
          url.startsWith('https://portal.latam.com') ||
          url.startsWith('https://iflightla.ibsplc.aero');
        const escalaxTabs = await chrome.tabs.query({ url: 'https://www.escalax.app.br/*' });
        sendResponse({ onAllowedDomain, hasEscalaxTab: escalaxTabs.length > 0, url });
      } catch (e) {
        sendResponse({ onAllowedDomain: false, hasEscalaxTab: false, url: '', error: e.message });
      }
    })();
    return true;
  }
});
