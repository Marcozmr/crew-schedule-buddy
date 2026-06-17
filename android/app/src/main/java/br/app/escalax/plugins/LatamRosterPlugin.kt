package br.app.escalax.plugins

import android.app.Activity
import android.content.Intent
import android.util.Base64
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File

@CapacitorPlugin(name = "LatamRosterPlugin")
class LatamRosterPlugin : Plugin() {

    @PluginMethod
    fun openLatamPortal(call: PluginCall) {
        val email = call.data?.getString("email") ?: ""
        val intent = Intent(activity, LatamWebViewActivity::class.java)
        intent.putExtra("latam_email", email)
        startActivityForResult(call, intent, "handleWebViewResult")
    }

    @ActivityCallback
    private fun handleWebViewResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return

        if (result.resultCode == Activity.RESULT_OK) {
            val data = result.data
            val ret = JSObject()
            ret.put("authenticated", data?.getBooleanExtra("authenticated", false) ?: false)
            ret.put("currentUrl", data?.getStringExtra("currentUrl") ?: "")

            val pdfFilePath = data?.getStringExtra("pdfFilePath")
            if (pdfFilePath != null) {
                val file = File(pdfFilePath.toString())
                if (file.exists()) {
                    try {
                        val bytes = file.readBytes()
                        file.delete()
                        ret.put("pdfDownloaded", true)
                        ret.put("pdfBase64", Base64.encodeToString(bytes, Base64.NO_WRAP))
                        ret.put("fileName", data.getStringExtra("fileName") ?: "CrewRosterReport.pdf")
                    } catch (e: Exception) {
                        ret.put("pdfDownloaded", false)
                        ret.put("pdfError", "Erro ao ler PDF: ${e.message}")
                    }
                } else {
                    ret.put("pdfDownloaded", false)
                }
            } else {
                ret.put("pdfDownloaded", false)
            }

            call.resolve(ret)
        } else {
            call.reject("Portal fechado pelo utilizador")
        }
    }
}
