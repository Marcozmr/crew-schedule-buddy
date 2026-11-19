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
  | { type: 'roster-json'; text: string; url: string }
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
  var RJSON = CFG.rosterJson ? new RegExp(CFG.rosterJson.s, CFG.rosterJson.f) : null;
  var gotJson = false;
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

  function isRosterJson(url) {
    return !!RJSON && RJSON.test(String(url || '').split('?')[0]);
  }

  // Só conta como escala o JSON com as linhas do relatório. Logo após o login o portal ainda
  // responde 403 em HTML; isso não pode encerrar as tentativas.
  function hasRosterRows(text) {
    try {
      var d = JSON.parse(String(text));
      var rows = d && d.model && d.model.cWPRosterWidgetModel && d.model.cWPRosterWidgetModel.cWPCrewRosterDayReportDTO;
      return Array.isArray(rows);
    } catch (e) { return false; }
  }

  function sendJson(text, url) {
    if (gotJson || !text || !hasRosterRows(text)) return;
    gotJson = true;
    send({ type: 'roster-json', text: String(text), url: absolute(url) });
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
          if (isRosterJson(resp.url || url)) {
            resp.clone().text().then(function (t) { sendJson(t, resp.url || url); }).catch(function () {});
          } else if (looksPdf(resp.headers.get('content-type'), resp.url || url)) {
            resp.clone().arrayBuffer().then(function (buf) { sendPdf(buf, reqInfo(method, url, body, ct)); });
          }
        } catch (e) {}
        return resp;
      });
    };
  }

  if (window.XMLHttpRequest) {
    var XP = window.XMLHttpRequest.prototype;
    var xo = XP.open;
    var xh = XP.setRequestHeader;
    var xs = XP.send;
    XP.open = function (m, u) {
      this.__ex = { m: m, u: u, ct: '' };
      return xo.apply(this, arguments);
    };
    XP.setRequestHeader = function (k, v) {
      if (this.__ex && /^content-type$/i.test(k)) this.__ex.ct = v;
      return xh.apply(this, arguments);
    };
    XP.send = function (b) {
      var x = this;
      var info = x.__ex || {};
      x.addEventListener('load', function () {
        try {
          var url = x.responseURL || info.u;
          if (isRosterJson(url) || isRosterJson(info.u)) {
            var rt = x.responseType;
            if (rt === '' || rt === 'text') sendJson(x.responseText, url);
            else if (rt === 'json' && x.response) sendJson(JSON.stringify(x.response), url);
            return;
          }
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

  // Relatório gerado por formulário num iframe escondido: o portal entrega o PDF como download,
  // que quebra no navegador do app. O app faz o POST e baixa o arquivo ele mesmo; se algo falhar,
  // a página segue o envio normal.
  var RPT = CFG.report ? {
    form: CFG.report.form,
    run: CFG.report.run,
    options: CFG.report.options,
    model: CFG.report.model,
    id: CFG.report.id,
    action: new RegExp(CFG.report.action.s, CFG.report.action.f),
    idPattern: new RegExp(CFG.report.idPattern.s, CFG.report.idPattern.f),
    download: CFG.report.download
  } : null;
  var reportAsked = 0;

  if (RPT && origFetch && window.HTMLFormElement) {
    var fsub = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function () {
      var form = this;
      var args = arguments;
      var action = absolute(form.getAttribute('action') || '');
      if (!RPT.action.test(action.split('?')[0])) return fsub.apply(form, args);
      var body;
      try { body = new URLSearchParams(new FormData(form)).toString(); } catch (e) { return fsub.apply(form, args); }
      reportAsked++;
      var fmt = String(RPT.id).toLowerCase();
      origFetch(action, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
      })
        .then(function (r) { return r.text(); })
        .then(function (html) {
          var m = String(html).match(RPT.idPattern);
          if (!m) throw new Error('sem id do relatório');
          var url = absolute(RPT.download.replace('{id}', encodeURIComponent(m[1])).replace('{format}', encodeURIComponent(fmt)));
          return origFetch(url, { credentials: 'include' }).then(function (r) { return r.arrayBuffer(); });
        })
        .then(function (buf) {
          if (!isPdf(buf)) throw new Error('relatório não é PDF');
          sendPdf(buf, { method: 'POST', url: action });
        })
        .catch(function () { try { fsub.apply(form, args); } catch (e) {} });
    };
  }

  function getPath(o, path) {
    var parts = String(path).split('.');
    for (var i = 0; i < parts.length && o != null; i++) o = o[parts[i]];
    return o;
  }

  function setPath(o, path, v) {
    var parts = String(path).split('.');
    for (var i = 0; i < parts.length - 1; i++) {
      o = o[parts[i]];
      if (o == null) return;
    }
    o[parts[parts.length - 1]] = v;
  }

  var runs = 0;
  var lastRunAt = 0;
  var askedAtRun = 0;
  // Escolhe o PDF e aperta o botão. Se o relatório não foi pedido em 4 s (tela ainda carregando),
  // tenta de novo; se foi pedido, espera o PDF por 20 s antes de tentar outra vez.
  var navDoneAt = 0;
  function tryRun() {
    if (gotPdf || gotJson || runs >= 5) return;
    // Com a escala em JSON disponível, o PDF só entra se o JSON não chegar em 12 s.
    if (RJSON && (!navDoneAt || Date.now() - navDoneAt < 12000)) return;
    if (lastRunAt && Date.now() - lastRunAt < (reportAsked > askedAtRun ? 20000 : 4000)) return;
    var form = document.querySelector(RPT.form);
    var btn = form && form.querySelector(RPT.run);
    if (!btn || !window.angular) return;
    try {
      var sc = window.angular.element(form).scope();
      var list = sc && getPath(sc, RPT.options);
      var pick = null;
      for (var i = 0; list && i < list.length; i++) {
        if (list[i] && list[i].id === RPT.id) { pick = list[i]; break; }
      }
      if (!pick) return;
      sc.$apply(function () { setPath(sc, RPT.model, pick); });
      try {
        var input = form.querySelector('[ng-model="' + RPT.model + '"]');
        if (input && window.jQuery) window.jQuery(input).select2('data', pick);
      } catch (e) {}
      runs++;
      lastRunAt = Date.now();
      askedAtRun = reportAsked;
      btn.click();
    } catch (e) {}
  }

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

  // Caminho rápido: pede a escala do mês pelo $http do Angular da página, que já manda os
  // cabeçalhos de sessão do portal. Repete até o portal liberar (403 logo após o login).
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function monthPeriod() {
    var now = new Date();
    var y = now.getFullYear();
    var m = now.getMonth();
    var last = new Date(y, m + 1, 0).getDate();
    return {
      periodFromDate: y + '-' + pad2(m + 1) + '-01T00:00:00.0',
      periodToDate: y + '-' + pad2(m + 1) + '-' + pad2(last) + 'T00:00:00.0',
      searchActualTimings: true,
      displayLocalTimings: true
    };
  }
  var fetchTries = 0;
  var fetchBusy = false;
  function tryFetchRoster() {
    if (gotJson || fetchBusy || fetchTries >= 60) return;
    var $http = null;
    try {
      var inj = window.angular && window.angular.element(document.body).injector();
      $http = inj && inj.get('$http');
    } catch (e) { $http = null; }
    if (!$http || typeof $http.post !== 'function') return;
    fetchTries++;
    fetchBusy = true;
    $http.post(CFG.rosterFetch.url, { cWPRosterReportSearchDTO: monthPeriod() }).then(function (r) {
      fetchBusy = false;
      var data = r && r.data;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { data = null; } }
      var rows = data && data.model && data.model.cWPRosterWidgetModel && data.model.cWPRosterWidgetModel.cWPCrewRosterDayReportDTO;
      if (rows && rows.length !== undefined) sendJson(JSON.stringify(data), CFG.rosterFetch.url);
    }, function () { fetchBusy = false; });
  }
  if (CFG.rosterFetch && onPortal()) {
    var fetchTimer = setInterval(function () {
      if (gotJson || gotPdf || fetchTries >= 60) { clearInterval(fetchTimer); return; }
      tryFetchRoster();
    }, 1000);
  }

  if (CFG.autoNav && onPortal()) {
    var step = 0;
    var nav = setInterval(function () {
      if (gotPdf || gotJson) { clearInterval(nav); return; }
      if (step < NAV.length) {
        var el = findClickable(NAV[step]);
        if (el) {
          step++;
          if (step >= NAV.length) navDoneAt = Date.now();
          try { el.click(); } catch (e) {}
        }
        return;
      }
      if (!RPT) { clearInterval(nav); return; }
      tryRun();
    }, 1500);
    // O passo a passo só aparece se a navegação travar; com relatório automático, espera mais.
    setTimeout(function () { if (!gotPdf && !gotJson && (!RPT || step < NAV.length)) showGuide(); }, 20000);
    if (RPT) setTimeout(function () { if (!gotPdf && !gotJson) showGuide(); }, 60000);
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
  const report = provider.report;
  const cfg = JSON.stringify({
    nav: provider.navSteps.map(serialize),
    portal: serialize(provider.portalHost),
    guide: provider.guideText,
    autoNav: opts.autoNav,
    rosterJson: provider.rosterJson ? serialize(provider.rosterJson) : null,
    rosterFetch: provider.rosterFetch ?? null,
    report: report
      ? {
          form: report.form,
          run: report.run,
          options: report.format.options,
          model: report.format.model,
          id: report.format.id,
          action: serialize(report.action),
          idPattern: serialize(report.idPattern),
          download: report.download,
        }
      : null,
  });
  return PAGE_BODY.replace('__HELPERS__', () => HELPERS).replace('__CFG__', () => cfg);
}

export function buildReplayScript(endpoint: LearnedEndpoint): string {
  return REPLAY_BODY.replace('__HELPERS__', () => HELPERS).replace('__EP__', () => JSON.stringify(endpoint));
}
