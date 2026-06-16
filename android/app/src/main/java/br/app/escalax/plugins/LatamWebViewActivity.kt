package br.app.escalax.plugins

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Bundle
import android.util.Base64
import android.view.Gravity
import android.view.View
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.RelativeLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.addCallback
import androidx.appcompat.app.AppCompatActivity
import okhttp3.Call
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException
import java.net.URI
import java.util.concurrent.TimeUnit

private const val TARGET_DOMAIN = "iflightla.ibsplc.aero"
private const val START_URL   = "https://portal.latam.com/pt/web/portalsab"

private enum class State { NAVIGATING, IFLIGHT_DETECTED, DOWNLOADING }

class LatamWebViewActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var topProgressBar: ProgressBar
    private lateinit var downloadOverlay: FrameLayout
    private lateinit var downloadStatusText: TextView

    @Volatile private var state = State.NAVIGATING
    private var currentIFlightUrl = ""
    private var downloadThread: Thread? = null
    private var activeCall: Call? = null

    private val httpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS)
            .build()
    }

    inner class BlobBridge {
        @JavascriptInterface
        fun onPdfData(base64: String) {
            if (state == State.DOWNLOADING) return
            state = State.DOWNLOADING
            runOnUiThread {
                downloadStatusText.text = "Importando Crew Roster Report…"
                webView.visibility = View.INVISIBLE
                downloadOverlay.visibility = View.VISIBLE
            }
            Thread {
                try {
                    val bytes = Base64.decode(base64, Base64.DEFAULT)
                    if (bytes.size < 512) throw IOException("PDF inválido")
                    val file = File(cacheDir, "latam_roster_${System.currentTimeMillis()}.pdf")
                    file.writeBytes(bytes)
                    if (!isFinishing) {
                        setResult(Activity.RESULT_OK, Intent().apply {
                            putExtra("authenticated", true)
                            putExtra("currentUrl", currentIFlightUrl)
                            putExtra("pdfFilePath", file.absolutePath)
                            putExtra("fileName", "CrewRosterReport.pdf")
                        })
                        finish()
                    }
                } catch (e: Exception) {
                    state = State.IFLIGHT_DETECTED
                    runOnUiThread {
                        downloadOverlay.visibility = View.GONE
                        webView.visibility = View.VISIBLE
                        Toast.makeText(this@LatamWebViewActivity,
                            "Erro ao processar PDF: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }.start()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supportActionBar?.hide()
        buildLayout()
        configureWebView()
        setupBackHandler()
        webView.loadUrl(START_URL)
    }

    private fun buildLayout() {
        val root = FrameLayout(this).apply { setBackgroundColor(Color.WHITE) }
        val inner = RelativeLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        }
        topProgressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            isIndeterminate = false; max = 100; id = View.generateViewId()
            layoutParams = RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.MATCH_PARENT, 8).also {
                it.addRule(RelativeLayout.ALIGN_PARENT_TOP) }
        }
        inner.addView(topProgressBar)
        webView = WebView(this).apply {
            layoutParams = RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.MATCH_PARENT,
                RelativeLayout.LayoutParams.MATCH_PARENT).also {
                it.addRule(RelativeLayout.BELOW, topProgressBar.id) }
        }
        inner.addView(webView)
        root.addView(inner)

        downloadOverlay = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#F8FAFC"))
            visibility = View.GONE
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        }
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER)
            setPadding(64, 64, 64, 64)
        }
        col.addView(ProgressBar(this).apply {
            isIndeterminate = true
            layoutParams = LinearLayout.LayoutParams(120, 120).also { it.gravity = Gravity.CENTER_HORIZONTAL }
        })
        downloadStatusText = TextView(this).apply {
            text = "Importando escala…"
            textSize = 16f
            setTextColor(Color.parseColor("#1E293B"))
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT).also { it.topMargin = 32 }
        }
        col.addView(downloadStatusText)
        col.addView(TextView(this).apply {
            text = "Aguarde, processando o Crew Roster Report…"
            textSize = 13f
            setTextColor(Color.parseColor("#64748B"))
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT).also { it.topMargin = 12 }
        })
        downloadOverlay.addView(col)
        root.addView(downloadOverlay)
        setContentView(root)
    }

    private fun configureWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            loadsImagesAutomatically = true
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            setSupportZoom(true)
            builtInZoomControls = false
            useWideViewPort = true
            loadWithOverviewMode = true
        }
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }
        webView.addJavascriptInterface(BlobBridge(), "__ex_bridge__")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) = false

            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                topProgressBar.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                topProgressBar.visibility = View.GONE
                when {
                    url.contains(TARGET_DOMAIN) && state == State.NAVIGATING -> {
                        state = State.IFLIGHT_DETECTED
                        currentIFlightUrl = url
                        injectIFlightJs()
                    }
                    url.contains(TARGET_DOMAIN) && state == State.IFLIGHT_DETECTED -> {
                        currentIFlightUrl = url
                        injectIFlightJs()
                    }
                    // Inject portal nav JS on any latam.com page while still navigating
                    url.contains("latam.com") && !url.contains(TARGET_DOMAIN)
                            && state == State.NAVIGATING -> {
                        injectPortalJs()
                    }
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                topProgressBar.progress = newProgress
                topProgressBar.visibility = if (newProgress < 100) View.VISIBLE else View.GONE
            }
        }

        webView.setDownloadListener(DownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            if (state == State.DOWNLOADING) return@DownloadListener
            val isPdf = mimeType.contains("pdf", ignoreCase = true) ||
                url.contains(".pdf", ignoreCase = true) ||
                contentDisposition.contains("pdf", ignoreCase = true)
            if (isPdf || state == State.IFLIGHT_DETECTED) {
                startHttpDownload(url, userAgent, contentDisposition)
            }
        })
    }

    private fun setupBackHandler() {
        onBackPressedDispatcher.addCallback(this) {
            when {
                state == State.DOWNLOADING -> {
                    activeCall?.cancel(); downloadThread?.interrupt()
                    setResult(Activity.RESULT_CANCELED); finish()
                }
                webView.canGoBack() -> webView.goBack()
                else -> { setResult(Activity.RESULT_CANCELED); finish() }
            }
        }
    }

    // ── PORTAL JS: clicks "iFlightNeo" or any iFlight tile ──────────────────
    private fun injectPortalJs() {
        val js = """
(function() {
  var now = Date.now();
  if (window.__ex_pt__ && (now - window.__ex_pt__) < 3000) return;
  window.__ex_pt__ = now;

  function findIFlight() {
    var els = Array.from(document.querySelectorAll('a,button,div,td,li,span'));
    for (var i = 0; i < els.length; i++) {
      var t = (els[i].textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
      if (t.length > 80) continue;
      if (t.indexOf('iflightneo') !== -1 || t === 'iflight' ||
          t.indexOf('crew web portal') !== -1 || t.indexOf('iflight neo') !== -1) return els[i];
    }
    var links = Array.from(document.querySelectorAll('a[href]'));
    for (var j = 0; j < links.length; j++) {
      if (/ibsplc|iflight/i.test(links[j].href)) return links[j];
    }
    return null;
  }

  function go() {
    var el = findIFlight();
    if (!el) return false;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    try { el.click(); } catch(e) {}
    return true;
  }

  if (go()) return;
  var n = 0, ob;
  var iv = setInterval(function() {
    if (go()) { clearInterval(iv); if (ob) ob.disconnect(); return; }
    if (++n >= 25) clearInterval(iv);
  }, 1000);
  ob = new MutationObserver(function() {
    if (go()) { ob.disconnect(); clearInterval(iv); }
  });
  ob.observe(document.documentElement, { childList: true, subtree: true });
})();
""".trimIndent()
        webView.evaluateJavascript(js, null)
    }

    // ── IFLIGHT JS: intercepts PDF + navigates Hamburger→Roster→Roster Calendar→Roster Report ──
    private fun injectIFlightJs() {
        val js = """
(function() {
  var now = Date.now();
  if (window.__ex_it__ && (now - window.__ex_it__) < 4000) return;
  window.__ex_it__ = now;

  // ── PDF HOOKS ────────────────────────────────────────────────────────────

  if (!window.__ex_h__) {
    window.__ex_h__ = true;

    function sendPdf(blob) {
      if (window.__ex_done__) return;
      var t = (blob.type || '').toLowerCase();
      if (blob.size < 100) return;
      var reader = new FileReader();
      reader.onload = function(e) {
        var b64 = e.target.result.split(',')[1];
        if (b64 && b64.length > 500 && window.__ex_bridge__) {
          window.__ex_done__ = true;
          window.__ex_bridge__.onPdfData(b64);
        }
      };
      reader.readAsDataURL(blob);
    }

    var oc = URL.createObjectURL;
    URL.createObjectURL = function(o) {
      var u = oc.call(URL, o);
      if (o instanceof Blob) sendPdf(o);
      return u;
    };

    var oo = XMLHttpRequest.prototype.open;
    var os = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function() { this.__eu = arguments[1]||''; return oo.apply(this,arguments); };
    XMLHttpRequest.prototype.send = function() {
      var x = this;
      x.addEventListener('load', function() {
        try {
          var r = x.response;
          if (r instanceof Blob) { sendPdf(r); return; }
          if (r instanceof ArrayBuffer) sendPdf(new Blob([r],{type:x.getResponseHeader('content-type')||'application/pdf'}));
        } catch(e) {}
      });
      return os.apply(this,arguments);
    };

    var of = window.fetch;
    window.fetch = function() {
      return of.apply(this,arguments).then(function(resp) {
        var ct = resp.headers.get('content-type')||'';
        if (ct.indexOf('pdf')!==-1) resp.clone().blob().then(sendPdf);
        return resp;
      });
    };

    document.addEventListener('click', function(e) {
      var el = e.target;
      for (var i=0;i<6&&el;i++,el=el.parentElement) {
        if (el.tagName==='A') {
          var h = el.href||'';
          if (h.indexOf('blob:')===0||/\.pdf/i.test(h)) {
            e.preventDefault(); e.stopImmediatePropagation();
            fetch(h).then(function(r){return r.blob();}).then(sendPdf).catch(function(){});
          }
          break;
        }
      }
    }, true);
  }

  // ── NAVIGATION STATE MACHINE ─────────────────────────────────────────────
  //  States: init → open-menu → click-roster → click-calendar → wait-load → click-report → done

  var __st = 'init', __st_ts = Date.now();

  function txt(el) { return (el.textContent||'').replace(/\s+/g,' ').trim().toLowerCase(); }

  function find(sel, kw, maxLen) {
    var els = Array.from(document.querySelectorAll(sel));
    for (var i=0;i<els.length;i++) {
      var t = txt(els[i]);
      if (maxLen && t.length > maxLen) continue;
      for (var k=0;k<kw.length;k++) if (t===kw[k]||t.indexOf(kw[k])!==-1) return els[i];
    }
    return null;
  }

  function click(el) {
    if (!el) return false;
    el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
    try{el.click();}catch(e){}
    return true;
  }

  function findHamburger() {
    // Try class-based
    var sel = '[class*="hamburger"],[class*="menu-btn"],[class*="menu-icon"],[class*="nav-toggle"],[class*="sidebar-toggle"],[class*="toggle-btn"]';
    var el = document.querySelector(sel);
    if (el) return el;
    // Try mat-icon "menu" (Angular Material)
    var icons = document.querySelectorAll('mat-icon,[class*="material-icon"],[class*="md-icon"]');
    for (var i=0;i<icons.length;i++) {
      if (txt(icons[i])==='menu') return icons[i].closest('button')||icons[i];
    }
    // Try header buttons
    var hdr = document.querySelector('header,.header,.app-header,.toolbar,.navbar');
    if (hdr) {
      var btns = hdr.querySelectorAll('button,a,[role=button]');
      for (var j=0;j<btns.length;j++) {
        var r = btns[j].getBoundingClientRect();
        if (r.width>0&&r.width<80&&r.height>0) return btns[j]; // Small button = likely hamburger
      }
    }
    // Position fallback: top-left corner
    var el2 = document.elementFromPoint(24, 36);
    if (el2&&el2.tagName!=='HTML'&&el2.tagName!=='BODY') return el2.closest('button')||el2.closest('a')||el2;
    return null;
  }

  function tryRosterReport() {
    return click(find('button,a,[role=button],[type=button]',['roster report'],40));
  }
  function tryRosterCalendar() {
    return click(find('a,button,[role=menuitem],li,td',['roster calendar'],50));
  }
  function tryRoster() {
    // "Roster" exactly (NOT "roster calendar" or "crew roster")
    var els = Array.from(document.querySelectorAll('a,button,[role=menuitem],li,td,span'));
    for (var i=0;i<els.length;i++) {
      if (txt(els[i])==='roster') return click(els[i]);
    }
    return false;
  }

  function showBanner() {
    if (document.getElementById('__ex_b__')) return;
    var b = document.createElement('div');
    b.id='__ex_b__';
    b.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:2147483647;font-family:system-ui,sans-serif;background:#0f172a;color:#f1f5f9;padding:12px 14px 16px;box-shadow:0 -4px 24px rgba(0,0,0,.6);box-sizing:border-box;';
    b.innerHTML='<div style="display:flex;align-items:flex-start;gap:10px;">'+
      '<div style="font-size:20px;margin-top:1px">✈</div>'+
      '<div style="flex:1;"><p style="margin:0 0 6px;font-size:13px;font-weight:700;">EscalaX — siga os passos:</p>'+
      '<ol style="margin:0;padding-left:16px;font-size:12px;line-height:1.8;color:#cbd5e1;">'+
        '<li>Menu <strong style="color:#fff">≡</strong> → <strong style="color:#fff">Roster</strong> → <strong style="color:#7dd3fc">Roster Calendar</strong></li>'+
        '<li>Role até o final da página</li>'+
        '<li>Toque em <strong style="color:#7dd3fc">Roster Report</strong></li>'+
        '<li>O PDF será capturado automaticamente ✓</li>'+
      '</ol></div>'+
      '<button onclick="document.getElementById(\'__ex_b__\').remove()" style="background:0;border:0;color:#475569;font-size:24px;cursor:pointer;padding:0 0 0 8px;line-height:1;flex-shrink:0;">×</button>'+
      '</div>';
    document.body.appendChild(b);
  }

  function transition(s) { __st = s; __st_ts = Date.now(); }

  var iv = setInterval(function() {
    var elapsed = Date.now() - __st_ts;

    if (__st === 'init') {
      // Already on Roster Calendar? Try clicking Roster Report directly
      if (tryRosterReport()) { transition('done'); return; }
      // Is "Roster Calendar" link already visible (menu open)?
      if (tryRosterCalendar()) { transition('wait-load'); return; }
      // Is "Roster" menu item visible (without hamburger)?
      if (tryRoster()) { transition('click-calendar'); return; }
      // Need to open hamburger
      if (elapsed > 2000) {
        var hb = findHamburger();
        if (hb) { click(hb); transition('open-menu'); }
        else if (elapsed > 8000) { transition('show-banner'); }
      }

    } else if (__st === 'open-menu') {
      if (elapsed < 800) return; // Wait for menu animation
      if (tryRoster()) { transition('click-calendar'); return; }
      // Maybe "Roster Calendar" became directly visible
      if (tryRosterCalendar()) { transition('wait-load'); return; }
      if (elapsed > 5000) transition('show-banner');

    } else if (__st === 'click-calendar') {
      if (elapsed < 400) return;
      if (tryRosterCalendar()) { transition('wait-load'); return; }
      if (elapsed > 5000) transition('show-banner');

    } else if (__st === 'wait-load') {
      // Wait 3 seconds after navigating to Roster Calendar before clicking
      if (elapsed < 3000) return;
      if (tryRosterReport()) { transition('done'); return; }
      if (elapsed > 12000) transition('show-banner');

    } else if (__st === 'show-banner') {
      showBanner(); transition('done');

    } else if (__st === 'done') {
      clearInterval(iv); obs.disconnect();
    }
  }, 600);

  // MutationObserver: catch "Roster Report" button appearing after SPA navigation
  var obs = new MutationObserver(function() {
    if (__st === 'wait-load' && (Date.now() - __st_ts) > 2000) {
      if (tryRosterReport()) { transition('done'); clearInterval(iv); obs.disconnect(); }
    }
    // Also try clicking it any time it appears
    if ((__st === 'init' || __st === 'open-menu' || __st === 'click-calendar') && tryRosterReport()) {
      transition('done'); clearInterval(iv); obs.disconnect();
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
""".trimIndent()
        webView.evaluateJavascript(js, null)
    }

    private fun startHttpDownload(url: String, userAgent: String, contentDisposition: String?) {
        if (state == State.DOWNLOADING) return
        state = State.DOWNLOADING
        val cookies = CookieManager.getInstance().getCookie(url) ?: ""
        val fileName = extractFileName(contentDisposition, url)
        runOnUiThread {
            downloadStatusText.text = "Baixando $fileName…"
            webView.visibility = View.INVISIBLE
            downloadOverlay.visibility = View.VISIBLE
        }
        downloadThread = Thread {
            try {
                val call = httpClient.newCall(Request.Builder().url(url)
                    .header("User-Agent", userAgent)
                    .apply { if (cookies.isNotEmpty()) header("Cookie", cookies) }
                    .header("Accept", "application/pdf,application/octet-stream,*/*")
                    .build())
                activeCall = call
                val resp = call.execute()
                if (!resp.isSuccessful) throw IOException("HTTP ${resp.code}")
                val bytes = resp.body?.bytes() ?: throw IOException("Resposta vazia")
                resp.close()
                val file = File(cacheDir, "latam_roster_${System.currentTimeMillis()}.pdf")
                file.writeBytes(bytes)
                if (!isFinishing) {
                    setResult(Activity.RESULT_OK, Intent().apply {
                        putExtra("authenticated", true)
                        putExtra("currentUrl", currentIFlightUrl)
                        putExtra("pdfFilePath", file.absolutePath)
                        putExtra("fileName", fileName)
                    })
                    finish()
                }
            } catch (e: Exception) {
                if (!isFinishing && state == State.DOWNLOADING) {
                    state = State.IFLIGHT_DETECTED
                    runOnUiThread {
                        downloadOverlay.visibility = View.GONE
                        webView.visibility = View.VISIBLE
                        val msg = e.message
                        if (!msg.isNullOrBlank() && !msg.contains("cancel", ignoreCase = true))
                            Toast.makeText(this, "Erro: $msg", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
        downloadThread?.start()
    }

    private fun extractFileName(contentDisposition: String?, url: String): String {
        contentDisposition?.takeIf { it.isNotBlank() }?.let { cd ->
            Regex("""filename[^;=\n]*=["']?([^"';\n]+)""", RegexOption.IGNORE_CASE)
                .find(cd)?.groupValues?.get(1)?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
        }
        return try {
            val seg = URI.create(url).path.substringAfterLast('/')
            if (seg.endsWith(".pdf", ignoreCase = true)) seg else "CrewRosterReport.pdf"
        } catch (_: Exception) { "CrewRosterReport.pdf" }
    }

    override fun onDestroy() {
        activeCall?.cancel()
        downloadThread?.interrupt()
        webView.destroy()
        super.onDestroy()
    }
}
