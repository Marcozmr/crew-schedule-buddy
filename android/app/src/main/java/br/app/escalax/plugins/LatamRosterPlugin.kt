package br.app.escalax.plugins

import android.app.Activity
import android.content.Intent
import com.getcapacitor.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "LatamRosterPlugin")
class LatamRosterPlugin : Plugin() {

    @PluginMethod
    fun openLatamPortal(call: PluginCall) {
        val intent = Intent(activity, LatamWebViewActivity::class.java)
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
            call.resolve(ret)
        } else {
            call.reject("Portal fechado pelo utilizador")
        }
    }
}
