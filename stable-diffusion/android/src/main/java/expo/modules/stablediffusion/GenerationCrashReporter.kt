package expo.modules.stablediffusion

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.os.Build
import android.util.Log
import java.io.File
import org.json.JSONArray
import org.json.JSONObject

internal object GenerationCrashReporter {
  private val FORBIDDEN_DIAGNOSTIC_KEYS = listOf(
    "prompt",
    "negativePrompt",
    "negative",
    "modelPath",
    "taesdPath",
    "outputPath",
    "alias",
    "fileName",
    "storedFileName",
    "uri",
    "seed",
    "variant",
    "variantEvidence",
  )

  fun consume(context: Context): String? {
    val file = generationDiagnosticFile(context)
    if (!file.isFile) return null
    val breadcrumb = runCatching { JSONObject(file.readText()) }.getOrNull() ?: run {
      file.delete()
      return null
    }
    stripForbiddenDiagnosticKeys(breadcrumb)
    if (breadcrumb.optString("status") != "running") {
      file.delete()
      return null
    }
    breadcrumb.put("schemaVersion", 3)
    breadcrumb.put("kind", "breadcrumb")
    val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    val device = deviceSnapshot(activityManager)
    val exitInfo = matchingExitInfo(activityManager, context.packageName, file.lastModified())
    val exit = exitSnapshot(exitInfo)
    val trace = exitInfo?.let { crashTrace(it) }
    attachTombstoneSignal(exit, trace?.signal)
    val frames = trace?.frames ?: emptyList()
    val topSymbol = TombstoneTraceParser.topSymbol(frames)
    val stage = breadcrumb.optString("stage", "unknown")
    val reason = exit.optString("reason", "unknown")
    val title = crashTitle(reason, exit.optInt("status", 0), stage, topSymbol)
    val stack = JSONObject()
    if (topSymbol == null) stack.put("topSymbol", JSONObject.NULL) else stack.put("topSymbol", topSymbol)
    val frameArray = JSONArray()
    for (frame in frames) {
      frameArray.put(
        JSONObject()
          .put("library", frame.library)
          .put("pc", frame.pc)
          .put("relPc", frame.relPc)
          .put("symbol", frame.symbol)
          .put("symbolOffset", frame.symbolOffset)
          .put("buildId", frame.buildId)
      )
    }
    stack.put("frames", frameArray)
    val report = JSONObject()
    report.put("schemaVersion", 3)
    report.put("kind", "generation_crash")
    report.put("title", title)
    report.put("breadcrumb", breadcrumb)
    report.put("device", device)
    report.put("exit", exit)
    report.put("stack", stack)
    val archived = lastCrashReportFile(context)
    archived.parentFile?.mkdirs()
    archived.writeText(report.toString())
    file.delete()
    val backend = breadcrumb.optJSONObject("backend")?.optString("diffusion") ?: "unknown"
    Log.i(
      "StableDiffusionBridge",
      "[crash] $title stage=$stage exit=$reason backend=$backend vulkan=${breadcrumb.optString("vulkanApi")} family=${breadcrumb.optString("family")} lora=${breadcrumb.optInt("loraCount")} symbol=${topSymbol ?: "none"}"
    )
    return report.toString()
  }

  fun diagnosticFile(context: Context): File {
    return generationDiagnosticFile(context)
  }

  private fun generationDiagnosticFile(context: Context): File {
    return File(context.filesDir, "diagnostics/generation-run.json")
  }

  private fun lastCrashReportFile(context: Context): File {
    return File(context.filesDir, "diagnostics/last-crash.json")
  }

  private fun stripForbiddenDiagnosticKeys(record: JSONObject) {
    for (key in FORBIDDEN_DIAGNOSTIC_KEYS) {
      record.remove(key)
    }
  }

  private fun deviceSnapshot(activityManager: ActivityManager): JSONObject {
    val memory = ActivityManager.MemoryInfo()
    activityManager.getMemoryInfo(memory)
    val device = JSONObject()
    device.put("manufacturer", Build.MANUFACTURER)
    device.put("model", Build.MODEL)
    device.put("hardware", Build.HARDWARE)
    device.put("sdk", Build.VERSION.SDK_INT)
    device.put("release", Build.VERSION.RELEASE)
    if (Build.VERSION.SDK_INT >= 31) {
      device.put("socModel", Build.SOC_MODEL)
    }
    device.put("totalRamMb", memory.totalMem / (1024 * 1024))
    return device
  }

  private fun matchingExitInfo(
    activityManager: ActivityManager,
    packageName: String,
    fileModifiedAt: Long
  ): ApplicationExitInfo? {
    if (Build.VERSION.SDK_INT < 30) return null
    val matches = activityManager.getHistoricalProcessExitReasons(packageName, 0, 5)
    return matches.firstOrNull { it.timestamp >= fileModifiedAt - 10_000 } ?: matches.firstOrNull()
  }

  private fun exitSnapshot(info: ApplicationExitInfo?): JSONObject {
    val exit = JSONObject()
    if (Build.VERSION.SDK_INT < 30) {
      exit.put("reason", "unavailable")
      return exit
    }
    if (info == null) {
      exit.put("reason", "unknown")
      return exit
    }
    val reason = exitReasonName(info.reason)
    exit.put("reason", reason)
    exit.put("status", info.status)
    exit.put("description", info.description ?: "")
    exit.put("timestamp", info.timestamp)
    exit.put("pssKb", info.pss)
    exit.put("rssKb", info.rss)
    crashSignalName(reason, info.status)?.let { exit.put("signalName", it) }
    return exit
  }

  private fun attachTombstoneSignal(exit: JSONObject, signal: TombstoneSignal?) {
    if (signal == null) return
    exit.put(
      "signal",
      JSONObject()
        .put("number", signal.number)
        .put("name", signal.name)
        .put("code", signal.code)
        .put("codeName", signal.codeName)
        .put("faultAddress", signal.faultAddress)
    )
    if (signal.name.isNotEmpty()) exit.put("signalName", signal.name)
  }

  private fun crashTrace(info: ApplicationExitInfo): TombstoneTrace? {
    if (Build.VERSION.SDK_INT < 31) return null
    return runCatching {
      val stream = info.traceInputStream ?: return null
      TombstoneTraceParser.parse(stream.readBytes())
    }.getOrNull()
  }

  private fun crashSignalName(reason: String, status: Int): String? {
    if (reason != "crash_native" && reason != "signaled") return null
    return when (status) {
      4 -> "SIGILL"
      5 -> "SIGTRAP"
      6 -> "SIGABRT"
      7 -> "SIGBUS"
      8 -> "SIGFPE"
      9 -> "SIGKILL"
      11 -> "SIGSEGV"
      else -> "signal_$status"
    }
  }

  private fun crashTitle(reason: String, status: Int, stage: String, symbol: String?): String {
    val signal = crashSignalName(reason, status)
    if (symbol != null && signal != null) return "native $signal at $symbol"
    if (symbol != null) return "native crash at $symbol"
    if (reason == "low_memory") return "process killed: low memory during $stage"
    if (signal != null) return "native $signal during $stage"
    return "process died during $stage ($reason)"
  }

  private fun exitReasonName(reason: Int): String {
    if (Build.VERSION.SDK_INT < 30) return "unavailable"
    return when (reason) {
      ApplicationExitInfo.REASON_EXIT_SELF -> "exit_self"
      ApplicationExitInfo.REASON_SIGNALED -> "signaled"
      ApplicationExitInfo.REASON_LOW_MEMORY -> "low_memory"
      ApplicationExitInfo.REASON_CRASH -> "crash"
      ApplicationExitInfo.REASON_CRASH_NATIVE -> "crash_native"
      ApplicationExitInfo.REASON_ANR -> "anr"
      ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> "initialization_failure"
      ApplicationExitInfo.REASON_PERMISSION_CHANGE -> "permission_change"
      ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "excessive_resource_usage"
      ApplicationExitInfo.REASON_USER_REQUESTED -> "user_requested"
      ApplicationExitInfo.REASON_USER_STOPPED -> "user_stopped"
      ApplicationExitInfo.REASON_DEPENDENCY_DIED -> "dependency_died"
      ApplicationExitInfo.REASON_OTHER -> "other"
      else -> "reason_$reason"
    }
  }
}
