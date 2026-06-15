package br.app.escalax.plugins

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.webkit.CookieManager
import android.webkit.DownloadListener
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
private const val START_URL = "https://portal.latam.com/pt/web/portalsab"

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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supportActionBar?.hide()
        buildLayout()
        configureWebView()
        setupBackHandler()
        webView.loadUrl(START_URL)
    }

    private fun buildLayout() {
        val root = FrameLayout(this)
        root.setBackgroundColor(Color.WHITE)

        // Inner relative layout for WebView + top progress bar
        val innerLayout = RelativeLayout(this)
        innerLayout.layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )

        topProgressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal)
        topProgressBar.isIndeterminate = false
        topProgressBar.max = 100
        topProgressBar.id = View.generateViewId()
        val pbParams = RelativeLayout.LayoutParams(RelativeLayout.LayoutParams.MATCH_PARENT, 8)
        pbParams.addRule(RelativeLayout.ALIGN_PARENT_TOP)
        topProgressBar.layoutParams = pbParams
        innerLayout.addView(topProgressBar)

        webView = WebView(this)
        val wvParams = RelativeLayout.LayoutParams(
            RelativeLayout.LayoutParams.MATCH_PARENT,
            RelativeLayout.LayoutParams.MATCH_PARENT
        )
        wvParams.addRule(RelativeLayout.BELOW, topProgressBar.id)
        webView.layoutParams = wvParams
        innerLayout.addView(webView)

        root.addView(innerLayout)

        // Download overlay (shown during OkHttp download)
        downloadOverlay = FrameLayout(this)
        downloadOverlay.setBackgroundColor(Color.parseColor("#F0F4FF"))
        downloadOverlay.visibility = View.GONE
        val overlayParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )
        downloadOverlay.layoutParams = overlayParams

        val col = LinearLayout(this)
        col.orientation = LinearLayout.VERTICAL
        col.gravity = Gravity.CENTER
        val colParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.CENTER
        )
        col.layoutParams = colParams
        col.setPadding(64, 64, 64, 64)

        val spinner = ProgressBar(this)
        spinner.isIndeterminate = true
        val spParams = LinearLayout.LayoutParams(120, 120)
        spParams.gravity = Gravity.CENTER_HORIZONTAL
        spinner.layoutParams = spParams
        col.addView(spinner)

        downloadStatusText = TextView(this)
        downloadStatusText.text = "Baixando Roster Report…"
        downloadStatusText.textSize = 16f
        downloadStatusText.setTextColor(Color.parseColor("#1E3A8A"))
        downloadStatusText.gravity = Gravity.CENTER
        val tvParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        )
        tvParams.topMargin = 32
        downloadStatusText.layoutParams = tvParams
        col.addView(downloadStatusText)

        val hint = TextView(this)
        hint.text = "Aguarde, isso pode levar alguns segundos…"
        hint.textSize = 13f
        hint.setTextColor(Color.parseColor("#64748B"))
        hint.gravity = Gravity.CENTER
        val hintParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        )
        hintParams.topMargin = 12
        hint.layoutParams = hintParams
        col.addView(hint)

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

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                return false // Let WebView handle all navigations
            }

            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                topProgressBar.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                topProgressBar.visibility = View.GONE
                if (url.contains(TARGET_DOMAIN) && state == State.NAVIGATING) {
                    state = State.IFLIGHT_DETECTED
                    currentIFlightUrl = url
                    injectRosterReportJs()
                } else if (url.contains(TARGET_DOMAIN) && state == State.IFLIGHT_DETECTED) {
                    // Re-inject on SPA navigation within iFlight
                    injectRosterReportJs()
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
                startPdfDownload(url, userAgent, contentDisposition, mimeType)
            }
        })
    }

    private fun setupBackHandler() {
        onBackPressedDispatcher.addCallback(this) {
            when {
                state == State.DOWNLOADING -> {
                    activeCall?.cancel()
                    downloadThread?.interrupt()
                    setResult(Activity.RESULT_CANCELED)
                    finish()
                }
                webView.canGoBack() -> webView.goBack()
                else -> {
                    setResult(Activity.RESULT_CANCELED)
                    finish()
                }
            }
        }
    }

    private fun injectRosterReportJs() {
        // Language note: JS is injected as a string — intentionally not logged
        val js = """
(function() {
  if (window.__escalax_v2__) return;
  window.__escalax_v2__ = true;

  function findRosterEl() {
    var keywords = ['roster report', 'crewrosterreport', 'crew roster report'];
    var nodes = Array.from(document.querySelectorAll('a,button,[role=button],td,li,span,div,p'));
    for (var i = 0; i < nodes.length; i++) {
      var t = (nodes[i].textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
      for (var k = 0; k < keywords.length; k++) {
        if (t === keywords[k] || t.indexOf(keywords[k]) !== -1) return nodes[i];
      }
    }
    var links = Array.from(document.querySelectorAll('a[href]'));
    for (var j = 0; j < links.length; j++) {
      var h = (links[j].href || '').toLowerCase();
      if (h.indexOf('rosterreport') !== -1 || h.indexOf('roster_report') !== -1) return links[j];
    }
    return null;
  }

  function tryClick() {
    var el = findRosterEl();
    if (el) { el.click(); return true; }
    return false;
  }

  function showBanner() {
    if (document.getElementById('__ex_banner__')) return;
    var b = document.createElement('div');
    b.id = '__ex_banner__';
    b.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:2147483647;' +
      'background:#1e3a8a;color:#fff;padding:14px 16px;display:flex;' +
      'align-items:center;gap:12px;box-shadow:0 -2px 12px rgba(0,0,0,.4);box-sizing:border-box;';
    var msg = document.createElement('span');
    msg.style.cssText = 'flex:1;font-size:14px;font-weight:600;line-height:1.3;';
    msg.textContent = 'EscalaX: Navegue até Roster Report — o download será capturado automaticamente.';
    var x = document.createElement('button');
    x.style.cssText = 'background:0;border:0;color:#93c5fd;font-size:22px;cursor:pointer;padding:0 4px;flex-shrink:0;';
    x.textContent = '×';
    x.onclick = function() { b.remove(); };
    b.appendChild(msg); b.appendChild(x);
    document.body.appendChild(b);
  }

  if (tryClick()) return;

  var attempts = 0;
  var iv = setInterval(function() {
    attempts++;
    if (tryClick()) { clearInterval(iv); return; }
    if (attempts >= 5) { clearInterval(iv); showBanner(); }
  }, 2000);

  var obs = new MutationObserver(function() {
    if (tryClick()) { obs.disconnect(); clearInterval(iv); }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
""".trimIndent()
        webView.evaluateJavascript(js, null)
    }

    private fun startPdfDownload(url: String, userAgent: String, contentDisposition: String?, mimeType: String) {
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
                val request = Request.Builder()
                    .url(url)
                    .header("User-Agent", userAgent)
                    .apply { if (cookies.isNotEmpty()) header("Cookie", cookies) }
                    .header("Accept", "application/pdf,application/octet-stream,*/*")
                    .build()

                val call = httpClient.newCall(request)
                activeCall = call
                val response = call.execute()

                if (!response.isSuccessful) throw IOException("HTTP ${response.code}")

                val bytes = response.body?.bytes() ?: throw IOException("Resposta vazia")
                response.close()

                val cacheFile = File(cacheDir, "latam_roster_${System.currentTimeMillis()}.pdf")
                cacheFile.writeBytes(bytes)

                if (!isFinishing) {
                    val intent = Intent().apply {
                        putExtra("authenticated", true)
                        putExtra("currentUrl", currentIFlightUrl)
                        putExtra("pdfFilePath", cacheFile.absolutePath)
                        putExtra("fileName", fileName)
                    }
                    setResult(Activity.RESULT_OK, intent)
                    finish()
                }
            } catch (e: Exception) {
                if (!isFinishing && state == State.DOWNLOADING) {
                    state = State.IFLIGHT_DETECTED
                    runOnUiThread {
                        downloadOverlay.visibility = View.GONE
                        webView.visibility = View.VISIBLE
                        val msg = if (e.message?.contains("cancel", ignoreCase = true) == true) null
                                  else "Falha ao baixar: ${e.message}"
                        if (msg != null) Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
        downloadThread?.start()
    }

    private fun extractFileName(contentDisposition: String?, url: String): String {
        if (!contentDisposition.isNullOrBlank()) {
            val match = Regex("""filename[^;=\n]*=["']?([^"';\n]+)""", RegexOption.IGNORE_CASE)
                .find(contentDisposition)
            val name = match?.groupValues?.get(1)?.trim()
            if (!name.isNullOrEmpty()) return name
        }
        return try {
            val seg = URI.create(url).path.substringAfterLast('/')
            if (seg.endsWith(".pdf", ignoreCase = true)) seg else "CrewRosterReport.pdf"
        } catch (_: Exception) {
            "CrewRosterReport.pdf"
        }
    }

    override fun onDestroy() {
        activeCall?.cancel()
        downloadThread?.interrupt()
        webView.destroy()
        super.onDestroy()
    }
}
