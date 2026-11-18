/**
 * SPIKE (descartável) — script injetado em TODAS as páginas abertas na WebView do iFlight.
 *
 * Objetivo: descobrir, no aparelho real, (1) se o login da LATAM conclui dentro da WebView e
 * (2) qual requisição do iFlight devolve a escala (PDF ou JSON). Ele não altera a página, não
 * clica em nada e nunca lê o valor de campos de formulário.
 *
 * Envia ao app (evento `messageFromWebview` do @capgo/inappbrowser):
 *  - {type:'hook'}  quando instala;
 *  - {type:'net'}   cada fetch/XHR: método, URL sem valores sensíveis, status, content-type e,
 *                   para JSON, só a FORMA (chaves), nunca os valores;
 *  - {type:'pdf'}   bytes (base64) de qualquer resposta que realmente seja PDF (começa com %PDF);
 *  - {type:'page'}  retrato da tela: título, itens de menu ligados à escala e erro de login conhecido;
 *  - {type:'open'}  window.open chamado pela página.
 *
 * Escrito em ES5 e como String.raw para que as barras das regex cheguem intactas à página.
 */
export const IFLIGHT_LAB_HOOK_SCRIPT = String.raw`
(function () {
  if (window.__escalaxLab) return;
  window.__escalaxLab = true;

  var MAX_PDF = 15 * 1024 * 1024;
  var queue = [];
  var seenPdf = {};
  var origFetch = window.fetch ? window.fetch.bind(window) : null;

  function bridgeSend(p) {
    var b = window.mobileApp;
    if (b && typeof b.postMessage === 'function') { b.postMessage({ detail: p }); return true; }
    var w = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.messageHandler;
    if (w) { w.postMessage({ detail: p }); return true; }
    var a = window.AndroidInterface;
    if (a && typeof a.postMessage === 'function') { a.postMessage(JSON.stringify({ detail: p })); return true; }
    return false;
  }

  function send(p) {
    p.frame = location.host;
    p.t = Date.now();
    try { if (bridgeSend(p)) return; } catch (e) {}
    queue.push(p);
  }

  setInterval(function () {
    while (queue.length) {
      try { if (!bridgeSend(queue[0])) return; } catch (e) { return; }
      queue.shift();
    }
  }, 500);

  var SENSITIVE_KEY = /token|saml|code|state|sess|auth|ticket|sig|pass|key|nonce|assertion|cookie/i;

  function clean(u) {
    try {
      var x = new URL(String(u), location.href);
      if (x.protocol === 'blob:' || x.protocol === 'data:') return x.protocol + '(…)';
      var parts = [];
      x.searchParams.forEach(function (v, k) {
        var safe = !SENSITIVE_KEY.test(k) && v.length <= 40;
        parts.push(k + '=' + (safe ? v : '…'));
      });
      return x.origin + x.pathname + (parts.length ? '?' + parts.join('&') : '');
    } catch (e) {
      return String(u).slice(0, 120);
    }
  }

  function keysOf(o) {
    var ks = Object.keys(o);
    return '{' + ks.slice(0, 12).join(',') + (ks.length > 12 ? ',…' : '') + '}';
  }

  function describe(v) {
    if (Array.isArray(v)) {
      var first = v[0];
      var inner = first && typeof first === 'object' && !Array.isArray(first) ? keysOf(first) : typeof first;
      return 'array[' + v.length + '] de ' + inner;
    }
    if (v && typeof v === 'object') return keysOf(v);
    return typeof v;
  }

  function shapeOf(json) {
    if (Array.isArray(json)) return { '(raiz)': describe(json) };
    if (!json || typeof json !== 'object') return { '(raiz)': typeof json };
    var out = {};
    Object.keys(json).slice(0, 25).forEach(function (k) { out[k] = describe(json[k]); });
    return out;
  }

  function bodyKeys(b) {
    try {
      if (!b) return undefined;
      if (typeof b === 'string') {
        if (b.charAt(0) === '{') return Object.keys(JSON.parse(b));
        return b.split('&').map(function (kv) { return kv.split('=')[0]; }).slice(0, 25);
      }
      if (typeof FormData !== 'undefined' && b instanceof FormData) {
        var ks = []; b.forEach(function (_v, k) { ks.push(k); }); return ks;
      }
      if (typeof URLSearchParams !== 'undefined' && b instanceof URLSearchParams) {
        var ps = []; b.forEach(function (_v, k) { ps.push(k); }); return ps;
      }
    } catch (e) {}
    return ['(corpo binário)'];
  }

  function isPdfBytes(buf) {
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

  function sendPdf(source, url, buf) {
    if (buf.byteLength > MAX_PDF) { send({ type: 'note', text: 'PDF grande demais ignorado', size: buf.byteLength }); return; }
    var head = new Uint8Array(buf, 0, Math.min(2048, buf.byteLength));
    var sum = 0;
    for (var i = 0; i < head.length; i++) sum = (sum * 31 + head[i]) >>> 0;
    var id = buf.byteLength + ':' + sum;
    if (seenPdf[id]) return;
    seenPdf[id] = true;
    send({ type: 'pdf', source: source, url: clean(url), size: buf.byteLength, base64: toB64(buf) });
  }

  var STATIC = /\.(js|css|png|jpe?g|gif|svg|webp|woff2?|ttf|ico|map)(\?|$)/i;

  function looksPdf(ct, url) {
    return /pdf/i.test(ct || '') || /\.pdf(\?|#|$)/i.test(url || '');
  }

  function onResponse(kind, method, url, status, ct, reqBody, getBuf) {
    if (STATIC.test(url || '')) return;
    var entry = {
      type: 'net', kind: kind, method: String(method || 'GET').toUpperCase(), url: clean(url),
      status: status, ct: String(ct || '').split(';')[0].trim(), body: bodyKeys(reqBody)
    };
    if (looksPdf(ct, url)) {
      getBuf().then(function (buf) {
        entry.size = buf.byteLength;
        if (isPdfBytes(buf)) sendPdf(kind, url, buf);
        else entry.note = 'content-type PDF mas não começa com %PDF';
        send(entry);
      }, function () { send(entry); });
      return;
    }
    if (/json/i.test(ct || '')) {
      getBuf().then(function (buf) {
        entry.size = buf.byteLength;
        try { entry.shape = shapeOf(JSON.parse(new TextDecoder().decode(buf))); } catch (e) { entry.note = 'JSON ilegível'; }
        send(entry);
      }, function () { send(entry); });
      return;
    }
    send(entry);
  }

  function grab(source, url) {
    if (!origFetch) return;
    origFetch(url, { credentials: 'include' }).then(function (r) {
      return r.arrayBuffer().then(function (buf) {
        if (isPdfBytes(buf)) sendPdf(source, url, buf);
        else send({ type: 'note', text: source + ': o link não devolveu PDF', url: clean(url), status: r.status });
      });
    }).catch(function (e) { send({ type: 'note', text: source + ': falhou ao baixar', url: clean(url), error: String(e) }); });
  }

  if (origFetch) {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || String(input);
      var method = (init && init.method) || (input && input.method) || 'GET';
      var body = init && init.body;
      return origFetch(input, init).then(function (resp) {
        try {
          onResponse('fetch', method, resp.url || url, resp.status, resp.headers.get('content-type'), body,
            function () { return resp.clone().arrayBuffer(); });
        } catch (e) {}
        return resp;
      });
    };
  }

  if (window.XMLHttpRequest) {
    var xo = XMLHttpRequest.prototype.open;
    var xs = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) {
      this.__lab = { m: m, u: u };
      return xo.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (b) {
      var x = this;
      var info = x.__lab || {};
      x.addEventListener('load', function () {
        try {
          var url = x.responseURL || info.u;
          var ct = x.getResponseHeader('content-type') || '';
          onResponse('xhr', info.m, url, x.status, ct, b, function () {
            var r = x.response;
            if (r instanceof ArrayBuffer) return Promise.resolve(r);
            if (typeof Blob !== 'undefined' && r instanceof Blob) return r.arrayBuffer();
            if (typeof r === 'string') {
              // PDF lido como texto chega corrompido: baixa de novo como binário (só GET).
              if (looksPdf(ct, url) && String(info.m || 'GET').toUpperCase() === 'GET' && origFetch) {
                return origFetch(url, { credentials: 'include' }).then(function (rr) { return rr.arrayBuffer(); });
              }
              return Promise.resolve(new TextEncoder().encode(r).buffer);
            }
            if (r && typeof r === 'object') return Promise.resolve(new TextEncoder().encode(JSON.stringify(r)).buffer);
            return Promise.resolve(new ArrayBuffer(0));
          });
        } catch (e) {}
      });
      return xs.apply(this, arguments);
    };
  }

  if (window.URL && URL.createObjectURL) {
    var co = URL.createObjectURL;
    URL.createObjectURL = function (obj) {
      try {
        if (typeof Blob !== 'undefined' && obj instanceof Blob && obj.size > 4 && obj.size <= MAX_PDF) {
          obj.arrayBuffer().then(function (buf) { if (isPdfBytes(buf)) sendPdf('blob', 'blob:', buf); });
        }
      } catch (e) {}
      return co.apply(this, arguments);
    };
  }

  if (window.open) {
    var wo = window.open;
    window.open = function (u) {
      try {
        send({ type: 'open', url: clean(u) });
        if (u && looksPdf('', String(u))) grab('window.open', String(u));
      } catch (e) {}
      return wo.apply(this, arguments);
    };
  }

  document.addEventListener('click', function (ev) {
    try {
      var el = ev.target;
      for (var i = 0; i < 6 && el; i++, el = el.parentElement) {
        if (el.tagName === 'A') {
          var h = el.href || '';
          if (h.indexOf('blob:') === 0 || /\.pdf(\?|#|$)|report/i.test(h)) grab('link', h);
          break;
        }
      }
    } catch (e) {}
  }, true);

  var NAV = /roster|escala|report|relat[oó]rio|pdf|calend|duty|pairing|crew|tripula|elenco|export|download|imprimir|print/i;
  var LOGIN_ERRORS = [
    /app_not_configured_for_user/i,
    /disallowed_useragent/i,
    /may not be secure|pode não ser seguro|não é seguro/i,
    /AADSTS\d+/i,
    /access denied|acesso negado|forbidden/i,
    /sess(ion|ão) expirad[ao]|session (has )?expired/i,
    /\b403\b|\b401\b/
  ];

  function pageText() {
    var b = document.body;
    if (!b) return '';
    return String(b.innerText || b.textContent || '').slice(0, 20000);
  }

  var lastKey = '';
  function snap() {
    try {
      var hits = [];
      var els = document.querySelectorAll('a,button,[role=button],[role=menuitem],[role=tab]');
      for (var i = 0; i < els.length && hits.length < 30; i++) {
        var t = String(els[i].innerText || els[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (t && t.length <= 60 && NAV.test(t) && hits.indexOf(t) < 0) hits.push(t);
      }
      var text = pageText();
      var errorHint;
      for (var j = 0; j < LOGIN_ERRORS.length; j++) {
        var m = text.match(LOGIN_ERRORS[j]);
        if (m) { errorHint = m[0]; break; }
      }
      var iframes = [];
      var fr = document.querySelectorAll('iframe,frame');
      for (var k = 0; k < fr.length && k < 10; k++) iframes.push(clean(fr[k].src || '(sem src)'));
      var key = location.href + '|' + document.title + '|' + hits.join(',') + '|' + errorHint + '|' + iframes.length;
      if (key === lastKey) return;
      lastKey = key;
      send({ type: 'page', url: clean(location.href), title: document.title, hits: hits, errorHint: errorHint, iframes: iframes });
    } catch (e) {}
  }

  send({ type: 'hook', url: clean(location.href) });
  setTimeout(snap, 10);
  document.addEventListener('DOMContentLoaded', function () { setTimeout(snap, 300); });
  window.addEventListener('load', function () { setTimeout(snap, 1500); });
  window.addEventListener('hashchange', function () { setTimeout(snap, 800); });
  window.addEventListener('popstate', function () { setTimeout(snap, 800); });
  setInterval(snap, 4000);
})();
`;
