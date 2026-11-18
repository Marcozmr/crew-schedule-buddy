/**
 * Scripts injetados na página do portal (iFlight) aberta na WebView do app.
 *
 * - buildPageScript: captura o PDF da escala junto com a requisição que o originou, mostra o
 *   selo de andamento, tenta navegar sozinho até o relatório e, se não conseguir em 20 s, mostra
 *   o passo a passo. Nunca lê campos de formulário nem altera o login.
 * - buildReplayScript: refaz, dentro da página e com a sessão dela, a requisição aprendida.
 *
 * Escritos em ES5 dentro de String.raw para as barras das regex chegarem intactas à página.
 */
import type { DevicePortalProvider, LearnedEndpoint } from './providers';

export type PageMessage =
  | { type: 'ready'; url: string }
  | { type: 'pdf'; base64: string; size: number; request: LearnedEndpoint | null }
  | { type: 'page'; url: string; title: string; errorHint?: string; navFound: boolean }
  | { type: 'replay-failed'; status: number; reason: string };

/** Ponte com o app (fila enquanto `window.mobileApp` não existe), checagem de PDF e base64. */
const HELPERS = String.raw`
  var __q = [];
  function __bridge(p) {
    var b = window.mobileApp;
    if (b && typeof b.postMessage === 'function') { b.postMessage({ detail: p }); return true; }
    var w = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.messageHandler;
    if (w) { w.postMessage({ detail: p }); return true; }
    var a = window.AndroidInterface;
    if (a && typeof a.postMessage === 'function') { a.postMessage(JSON.stringify({ detail: p })); return true; }
    return false;
  }
  function send(p) {
    try { if (__bridge(p)) return; } catch (e) {}
    __q.push(p);
  }
  setInterval(function () {
    while (__q.length) {
      try { if (!__bridge(__q[0])) return; } catch (e) { return; }
      __q.shift();
    }
  }, 500);
  function isPdf(buf) {
    var u = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
    return u.length === 4 && u[0] === 0x25 && u[1] === 0x50 && u[2] === 0x44 && u[3] === 0x46;
  }
  function toB64(buf) {
    var bytes = new Uint8Array(buf);
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }
  function blobToBuf(blob) {
    if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(fr.error); };
      fr.readAsArrayBuffer(blob);
    });
  }
`;

const PAGE_BODY = String.raw`
(function () {
  if (window.__escalaxPortal) return;
  window.__escalaxPortal = true;
  var CFG = __CFG__;
  var NAV = CFG.nav.map(function (o) { return new RegExp(o.s, o.f); });
  var PORTAL = new RegExp(CFG.portal.s, CFG.portal.f);
  var MAX = 15 * 1024 * 1024;
  var seen = {};
  var gotPdf = false;
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  window.__escalaxOrigFetch = origFetch;
  __HELPERS__

  function onPortal() {
    try { return PORTAL.test(location.hostname); } catch (e) { return false; }
  }

  function absolute(u) {
    try { return new URL(String(u), location.href).href; } catch (e) { return String(u); }
  }

  function reqInfo(method, url, body, ct) {
    var r = { method: String(method || 'GET').toUpperCase(), url: absolute(url) };
    if (typeof body === 'string' && body.length) r.body = body;
    if (ct) r.contentType = ct;
    return r;
  }

  function headerCt(h) {
    try {
      if (!h) return '';
      if (typeof h.get === 'function') return h.get('content-type') || '';
      return h['Content-Type'] || h['content-type'] || '';
    } catch (e) { return ''; }
  }

  function looksPdf(ct, url) {
    return /pdf/i.test(ct || '') || /\.pdf(\?|#|$)/i.test(url || '');
  }

  function fingerprint(buf) {
    var head = new Uint8Array(buf, 0, Math.min(4096, buf.byteLength));
    var sum = 0;
    for (var i = 0; i < head.length; i++) sum = (sum * 31 + head[i]) >>> 0;
    return buf.byteLength + ':' + sum;
  }

  function emitPdf(buf, request) {
    var id = fingerprint(buf);
    if (seen[id]) return;
    seen[id] = true;
    gotPdf = true;
    send({ type: 'pdf', base64: toB64(buf), size: buf.byteLength, request: request || null });
  }

  function sendPdf(buf, request) {
    if (!isPdf(buf) || buf.byteLength > MAX) return;
    if (request) { emitPdf(buf, request); return; }
    // Captura sem a requisição de origem (blob): espera um pouco para a versão com requisição ganhar.
    setTimeout(function () { emitPdf(buf, null); }, 1500);
  }

  function grab(url) {
    if (!origFetch) return;
    origFetch(url, { credentials: 'include' }).then(function (r) { return r.arrayBuffer(); })
      .then(function (buf) { sendPdf(buf, reqInfo('GET', url)); })
      .catch(function () {});
  }

  if (origFetch) {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || String(input);
      var method = (init && init.method) || (input && input.method) || 'GET';
      var body = init && init.body;
      var ct = headerCt(init && init.headers);
      return origFetch(input, init).then(function (resp) {
        try {
          if (looksPdf(resp.headers.get('content-type'), resp.url || url)) {
            resp.clone().arrayBuffer().then(function (buf) { sendPdf(buf, reqInfo(method, url, body, ct)); });
          }
        } catch (e) {}
        return resp;
      });
    };
  }

  if (window.XMLHttpRequest) {
    var xo = XMLHttpRequest.prototype.open;
    var xh = XMLHttpRequest.prototype.setRequestHeader;
    var xs = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) {
      this.__ex = { m: m, u: u, ct: '' };
      return xo.apply(this, arguments);
    };
    XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
      if (this.__ex && /^content-type$/i.test(k)) this.__ex.ct = v;
      return xh.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (b) {
      var x = this;
      var info = x.__ex || {};
      x.addEventListener('load', function () {
        try {
          var url = x.responseURL || info.u;
          if (!looksPdf(x.getResponseHeader('content-type'), url)) return;
          var request = reqInfo(info.m, url, b, info.ct);
          var r = x.response;
          if (r instanceof ArrayBuffer) { sendPdf(r, request); return; }
          if (typeof Blob !== 'undefined' && r instanceof Blob) { blobToBuf(r).then(function (buf) { sendPdf(buf, request); }); return; }
          if (typeof r === 'string' && request.method === 'GET' && origFetch) {
            // PDF lido como texto chega corrompido: baixa de novo como binário.
            origFetch(url, { credentials: 'include' }).then(function (rr) { return rr.arrayBuffer(); })
              .then(function (buf) { sendPdf(buf, request); }).catch(function () {});
          }
        } catch (e) {}
      });
      return xs.apply(this, arguments);
    };
  }

  if (window.URL && URL.createObjectURL) {
    var co = URL.createObjectURL;
    URL.createObjectURL = function (obj) {
      try {
        if (typeof Blob !== 'undefined' && obj instanceof Blob && obj.size > 4 && obj.size <= MAX) {
          blobToBuf(obj).then(function (buf) { sendPdf(buf, null); });
        }
      } catch (e) {}
      return co.apply(this, arguments);
    };
  }

  if (window.open) {
    var wo = window.open;
    window.open = function (u) {
      try { if (u && looksPdf('', String(u))) grab(String(u)); } catch (e) {}
      return wo.apply(this, arguments);
    };
  }

  document.addEventListener('click', function (ev) {
    try {
      var el = ev.target;
      for (var i = 0; i < 6 && el; i++, el = el.parentElement) {
        if (el.tagName === 'A') {
          var h = el.href || '';
          if (h.indexOf('blob:') === 0 || /\.pdf(\?|#|$)/i.test(h)) grab(h);
          break;
        }
      }
    } catch (e) {}
  }, true);

  function ensureStatus() {
    if (!document.body) return null;
    var el = document.getElementById('escalax-status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'escalax-status';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
        'background:#15803D;color:#fff;font:600 14px system-ui,-apple-system,sans-serif;padding:10px 16px;' +
        'border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.25);pointer-events:none;white-space:nowrap;';
      el.textContent = 'EscalaX · Conectando ao portal';
      document.body.appendChild(el);
    }
    return el;
  }

  window.addEventListener('messageFromNative', function (ev) {
    var d = ev && ev.detail;
    if (d && d.label) {
      var el = ensureStatus();
      if (el) el.textContent = 'EscalaX · ' + d.label;
    }
  });

  function showGuide() {
    if (!document.body || document.getElementById('escalax-guide')) return;
    var g = document.createElement('div');
    g.id = 'escalax-guide';
    g.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;background:#111827;color:#F3F4F6;' +
      'font:500 14px/1.5 system-ui,-apple-system,sans-serif;padding:14px 16px;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,.35);';
    g.textContent = 'EscalaX: abra a escala por aqui — ' + CFG.guide + '. O app salva sozinho quando o PDF abrir.';
    document.body.appendChild(g);
  }

  function findClickable(re) {
    var groups = ['a,button,[role=button],[role=menuitem],[role=tab],[role=link]', 'li,span,div,td'];
    for (var gi = 0; gi < groups.length; gi++) {
      var els = document.querySelectorAll(groups[gi]);
      for (var i = 0; i < els.length; i++) {
        var t = String(els[i].innerText || els[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (t && t.length <= 40 && re.test(t)) return els[i];
      }
    }
    return null;
  }

  if (CFG.autoNav && onPortal()) {
    var step = 0;
    var nav = setInterval(function () {
      if (gotPdf || step >= NAV.length) { clearInterval(nav); return; }
      var el = findClickable(NAV[step]);
      if (el) { step++; try { el.click(); } catch (e) {} }
    }, 1500);
    setTimeout(function () { if (!gotPdf) showGuide(); }, 20000);
  }

  var LOGIN_ERRORS = [
    /app_not_configured_for_user/i,
    /disallowed_useragent/i,
    /may not be secure|pode não ser seguro|não é seguro/i,
    /AADSTS\d+/i,
    /access denied|acesso negado/i
  ];
  var lastKey = '';
  function snap() {
    try {
      var text = document.body ? String(document.body.innerText || document.body.textContent || '').slice(0, 20000) : '';
      var hint;
      for (var j = 0; j < LOGIN_ERRORS.length; j++) {
        var m = text.match(LOGIN_ERRORS[j]);
        if (m) { hint = m[0]; break; }
      }
      var navFound = NAV.length > 0 && !!findClickable(NAV[0]);
      var url = location.origin + location.pathname;
      var key = url + '|' + document.title + '|' + hint + '|' + navFound;
      if (key === lastKey) return;
      lastKey = key;
      var msg = { type: 'page', url: url, title: document.title, navFound: navFound };
      if (hint) msg.errorHint = hint;
      send(msg);
    } catch (e) {}
  }

  send({ type: 'ready', url: location.origin + location.pathname });
  setTimeout(snap, 10);
  document.addEventListener('DOMContentLoaded', function () { setTimeout(snap, 300); });
  window.addEventListener('load', function () { setTimeout(snap, 1500); });
  setInterval(snap, 4000);
})();
`;

const REPLAY_BODY = String.raw`
(function () {
  var EP = __EP__;
  __HELPERS__
  var f = window.__escalaxOrigFetch || window.fetch;
  var init = { method: EP.method, credentials: 'include' };
  if (EP.body) init.body = EP.body;
  if (EP.contentType) init.headers = { 'Content-Type': EP.contentType };
  f(EP.url, init).then(function (r) {
    return r.arrayBuffer().then(function (buf) {
      if (isPdf(buf)) send({ type: 'pdf', base64: toB64(buf), size: buf.byteLength, request: EP });
      else send({ type: 'replay-failed', status: r.status, reason: 'not_pdf' });
    });
  }).catch(function (e) {
    send({ type: 'replay-failed', status: 0, reason: String((e && e.message) || e) });
  });
})();
`;

function serialize(re: RegExp): { s: string; f: string } {
  return { s: re.source, f: re.flags };
}

export function buildPageScript(provider: DevicePortalProvider, opts: { autoNav: boolean }): string {
  const cfg = JSON.stringify({
    nav: provider.navSteps.map(serialize),
    portal: serialize(provider.portalHost),
    guide: provider.guideText,
    autoNav: opts.autoNav,
  });
  return PAGE_BODY.replace('__HELPERS__', () => HELPERS).replace('__CFG__', () => cfg);
}

export function buildReplayScript(endpoint: LearnedEndpoint): string {
  return REPLAY_BODY.replace('__HELPERS__', () => HELPERS).replace('__EP__', () => JSON.stringify(endpoint));
}
