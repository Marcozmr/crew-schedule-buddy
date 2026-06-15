/**
 * Content script — injetado em https://www.escalax.app.br/*
 * Responde a mensagens do background service worker com o access_token
 * da sessão Supabase armazenada no localStorage da aba do EscalaX.
 *
 * Nunca envia credenciais para fora do worker — apenas retorna ao background
 * que já está dentro da extensão.
 */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'GET_AUTH_TOKEN') return;

  try {
    const keys = Object.keys(localStorage);
    // Supabase armazena a sessão com chave sb-{project-ref}-auth-token
    const sbKey = keys.find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (!sbKey) {
      sendResponse({ token: null, reason: 'no_supabase_key' });
      return;
    }
    const raw = localStorage.getItem(sbKey);
    if (!raw) {
      sendResponse({ token: null, reason: 'empty_value' });
      return;
    }
    const parsed = JSON.parse(raw);
    const token = parsed?.access_token ?? null;
    sendResponse({ token });
  } catch {
    sendResponse({ token: null, reason: 'parse_error' });
  }

  return true; // sinaliza resposta assíncrona
});
