/**
 * Popup da extensão EscalaX — Sessão iFlight.
 * Gere os ecrãs e coordena com background.js via chrome.runtime.sendMessage.
 */

const screens = {
  loading:     document.getElementById('screen-loading'),
  noEscalax:   document.getElementById('screen-no-escalax'),
  wrongDomain: document.getElementById('screen-wrong-domain'),
  consent:     document.getElementById('screen-consent'),
  sending:     document.getElementById('screen-sending'),
  connected:   document.getElementById('screen-connected'),
  error:       document.getElementById('screen-error'),
};

function showOnly(id) {
  Object.values(screens).forEach((el) => { if (el) el.style.display = 'none'; });
  const target = screens[id];
  if (target) target.style.display = 'block';
}

function setError(msg) {
  const el = document.getElementById('error-msg');
  if (el) el.textContent = msg || 'Ocorreu um erro. Tente novamente.';
  showOnly('error');
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function showConnected(status) {
  const msgEl = document.getElementById('connected-msg');
  const validEl = document.getElementById('session-valid-until');

  if (msgEl) {
    if (status.status === 'roster_connected') {
      msgEl.textContent = 'Escala sincronizada com sucesso. A sessão iFlight está ativa.';
    } else if (status.status === 'reconnect_required') {
      msgEl.textContent = 'Sua sessão expirou. Faça login no iFlight Neo e autorize novamente.';
    } else {
      msgEl.textContent = 'Sessão iFlight ativa. O EscalaX sincronizará sua escala automaticamente.';
    }
  }

  if (validEl && status.validUntil) {
    validEl.textContent = `Válida até: ${formatDate(status.validUntil)}`;
  }

  showOnly('connected');
}

async function loadStatus() {
  showOnly('loading');

  // 1. Verifica aba atual e presença do EscalaX
  const tabInfo = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'CHECK_TAB' }, resolve);
  });

  if (!tabInfo.hasEscalaxTab) {
    showOnly('noEscalax');
    return;
  }

  // 2. Consulta estado da sessão no worker
  const statusRes = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, resolve);
  });

  if (!statusRes.ok && statusRes.reason === 'no_auth') {
    showOnly('noEscalax');
    return;
  }

  if (!statusRes.ok) {
    // Worker inacessível ou outro erro — não bloqueia o fluxo de consentimento
    // Verifica se está no domínio correto para permitir captura
    if (!tabInfo.onAllowedDomain) {
      showOnly('wrongDomain');
    } else {
      showOnly('consent');
    }
    return;
  }

  // 3. Sessão já existe e está conectada
  if (statusRes.connected || statusRes.status === 'roster_connected' || statusRes.status === 'portal_connected') {
    showConnected(statusRes);
    return;
  }

  // 4. Sessão em erro / desconectada — permite reconectar
  if (!tabInfo.onAllowedDomain) {
    showOnly('wrongDomain');
    return;
  }

  showOnly('consent');
}

async function doImport() {
  showOnly('sending');

  const result = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'IMPORT_SESSION' }, resolve);
  });

  if (!result.ok) {
    if (result.reason === 'no_auth') {
      showOnly('noEscalax');
      return;
    }
    if (result.reason === 'no_cookies') {
      setError('Nenhum cookie de sessão encontrado. Certifique-se de estar logado no iFlight Neo ou portal.latam.com.');
      return;
    }
    setError(result.error || 'Não foi possível enviar a sessão.');
    return;
  }

  // Recarrega status para mostrar estado atualizado
  await loadStatus();
}

async function doRevoke() {
  if (!confirm('Revogar a sessão iFlight do EscalaX? Você precisará autorizar novamente para sincronizar automaticamente.')) {
    return;
  }

  const statusRes = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, resolve);
  });

  if (!statusRes.ok || !statusRes.sessionId) {
    setError('Não foi possível localizar a sessão para revogar.');
    return;
  }

  // Envia DELETE diretamente — o background não tem handler para isso,
  // então chamamos o worker com o token obtido via GET_STATUS.
  // Usamos a mesma sequência: background GET_STATUS já valida o token.
  // Para simplicidade, exibimos a tela de consentimento após revogação.
  showOnly('loading');

  // Pede ao background para revogar
  const result = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'REVOKE_SESSION' }, resolve);
  });

  if (result && result.ok === false) {
    setError(result.error || 'Não foi possível revogar.');
    return;
  }

  showOnly('consent');
}

// ── Event listeners ────────────────────────────────────────────────────────────

document.getElementById('btn-authorize')?.addEventListener('click', () => void doImport());
document.getElementById('btn-cancel')?.addEventListener('click', () => window.close());
document.getElementById('btn-retry')?.addEventListener('click', () => void loadStatus());
document.getElementById('btn-resync')?.addEventListener('click', () => void doImport());
document.getElementById('btn-revoke')?.addEventListener('click', () => void doRevoke());

// ── Arranque ──────────────────────────────────────────────────────────────────

void loadStatus();
