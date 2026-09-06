package expo.modules.stablediffusion

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.annotation.Keep
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord
import java.io.File
import org.json.JSONArray
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.json.JSONObject

@OptimizedRecord
internal data class GenerationOptions(
  @Field val negativePrompt: String,
  @Field val width: Int,
  @Field val height: Int,
  @Field val samplingPreset: String,
  @Field val steps: Int,
  @Field val cfgScale: Double,
  @Field val seed: Long,
  @Field val upscalerType: String,
  @Field val upscaleFactor: Double,
  @Field val hiresSteps: Int,
  @Field val hiresDenoisingStrength: Double,
  @Field val modelFamily: String,
  @Field val modelFamilyEvidence: String,
  @Field val modelVariant: String,
  @Field val modelVariantEvidence: String,
  @Field val diffusionStorage: String,
  @Field val diffusionBytes: Double,
  @Field val vaeArchitecture: String
) : Record

class StableDiffusionModule : Module() {

  private val nativeOperationQueue = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  companion object {
    init {
      System.loadLibrary("stable_diffusion_bridge")
    }

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
    )
  }

  private external fun getSystemInfo(): String
  private external fun quantizeModel(inputPath: String, outputPath: String, type: String): String
  private external fun generateImage(
    prompt: String,
    negativePrompt: String,
    modelPath: String,
    taesdPath: String,
    modelFamily: String,
    modelFamilyEvidence: String,
    modelVariant: String,
    modelVariantEvidence: String,
    diffusionStorage: String,
    diffusionBytes: Double,
    vaeArchitecture: String,
    loraPaths: Array<String>,
    loraWeights: DoubleArray,
    width: Int,
    height: Int,
    samplingPreset: String,
    steps: Int,
    cfgScale: Double,
    seed: Long,
    upscalerType: String,
    upscaleFactor: Double,
    hiresSteps: Int,
    hiresDenoisingStrength: Double,
    outputPath: String,
    diagnosticPath: String
  ): String

  @Keep
  private fun emitProgress(stage: String, step: Int, steps: Int) {
    sendEvent("onProgress", mapOf("stage" to stage, "step" to step, "steps" to steps))
  }

  @Keep
  private fun emitQuantizationProgress(completedTensors: Int, totalTensors: Int) {
    sendEvent(
      "onQuantizationProgress",
      mapOf("completedTensors" to completedTensors, "totalTensors" to totalTensors)
    )
  }

  override fun definition() = ModuleDefinition {
    Name("StableDiffusion")
    Events("onProgress", "onQuantizationProgress")
    OnDestroy { nativeOperationQueue.cancel() }

    Function("getSystemInfo") {
      return@Function getSystemInfo()
    }

    AsyncFunction("consumeInterruptedGeneration") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      consumeInterruptedGeneration(context)
    }

    AsyncFunction("quantizeModel") { inputUri: String, outputUri: String, type: String ->
      val context = appContext.reactContext ?: throw Exception("React context not found")
      val supportedTypes = setOf("q8_0", "q5_0", "q5_1", "q4_0", "q4_1", "q4_K")
      require(type in supportedTypes) { "Unsupported quantization type" }

      val filesRoot = context.filesDir.canonicalFile
      fun appFile(uri: String): File {
        val file = File(requireNotNull(Uri.parse(uri).path) { "Invalid file URI" }).canonicalFile
        require(file.path.startsWith(filesRoot.path + File.separator)) { "File must be in app storage" }
        return file
      }

      val inputFile = appFile(inputUri)
      val outputFile = appFile(outputUri)
      require(inputFile.isFile) { "Input model not found" }
      require(inputFile != outputFile) { "Input and output files must be different" }
      require(!outputFile.exists()) { "Output file already exists" }
      require(outputFile.parentFile?.isDirectory == true) { "Output directory not found" }

      return@AsyncFunction quantizeModel(inputFile.absolutePath, outputFile.absolutePath, type)
    }.runOnQueue(nativeOperationQueue)

    AsyncFunction("generateImage") {
        prompt: String,
        modelUri: String,
        taesdUri: String,
        loraUris: List<String>,
        loraWeights: List<Double>,
        options: GenerationOptions,
        outputUri: String ->
      val context = appContext.reactContext ?: throw Exception("React context not found")
      require(prompt.isNotBlank()) { "Prompt must not be blank" }
      require(options.steps in 1..100) { "Steps must be between 1 and 100" }
      require(options.width in 64..2048 && options.height in 64..2048) { "Image size must be between 64 and 2048" }
      require(options.samplingPreset.isNotBlank()) { "Sampling preset must not be blank" }
      require(options.cfgScale.isFinite() && options.cfgScale in 0.0..30.0) { "CFG scale must be between 0 and 30" }
      require(options.seed >= -1) { "Seed must be -1 or greater" }
      require(options.upscalerType.isNotBlank()) { "Upscaler type must not be blank" }
      require(options.upscaleFactor.isFinite() && options.upscaleFactor in 1.5..4.0 && options.upscaleFactor * 2 % 1 == 0.0) {
        "Upscale factor must be between 1.5 and 4.0 in 0.5 increments"
      }
      require(options.hiresSteps in 0..100) { "Hires steps must be between 0 and 100" }
      require(options.hiresDenoisingStrength.isFinite() && options.hiresDenoisingStrength in 0.0001..1.0) {
        "Hires denoising strength must be between 0.0001 and 1"
      }
      require(options.modelFamily in setOf("sd1", "sdxl", "anima", "unknown")) { "Unsupported model family" }
      require(options.modelFamilyEvidence in setOf("tensor-signature", "insufficient")) { "Unsupported family evidence" }
      require(options.modelVariant in setOf("turbo", "unknown")) { "Unsupported model variant" }
      require(options.modelVariantEvidence in setOf("gguf-metadata", "safetensors-metadata", "original-file-name", "alias", "insufficient")) {
        "Unsupported variant evidence"
      }
      require(options.diffusionStorage in setOf("f32", "f16", "bf16", "f8", "q4", "q5", "q8", "mixed", "unknown")) {
        "Unsupported diffusion storage"
      }
      require(options.diffusionBytes.isFinite() && options.diffusionBytes >= 0.0) { "Invalid diffusion byte estimate" }
      require(options.vaeArchitecture in setOf("autoencoder-kl", "unknown")) { "Unsupported VAE architecture" }
      require(loraUris.size == loraWeights.size) { "LoRA paths and weights must match" }
      require(loraWeights.all { it.isFinite() && it in 0.0..2.0 }) {
        "LoRA weights must be between 0 and 2"
      }

      val filesRoot = context.filesDir.canonicalFile
      fun appFile(uri: String, mustExist: Boolean): File {
        val file = File(requireNotNull(Uri.parse(uri).path) { "Invalid file URI" }).canonicalFile
        require(file.path.startsWith(filesRoot.path + File.separator)) { "File must be in app storage" }
        require(!mustExist || file.isFile) { "File not found: ${file.name}" }
        return file
      }

      val modelPath = appFile(modelUri, true).absolutePath
      val taesdPath = if (taesdUri.isBlank()) "" else appFile(taesdUri, true).absolutePath
      val loraPaths = loraUris.map { appFile(it, true).absolutePath }.toTypedArray()
      val outputFile = appFile(outputUri, false)
      require(outputFile.parentFile?.isDirectory == true) { "Output directory not found" }
      val diagnosticFile = generationDiagnosticFile(context)
      diagnosticFile.parentFile?.mkdirs()

      return@AsyncFunction generateImage(
        prompt.trim(),
        options.negativePrompt.trim(),
        modelPath,
        taesdPath,
        options.modelFamily,
        options.modelFamilyEvidence,
        options.modelVariant,
        options.modelVariantEvidence,
        options.diffusionStorage,
        options.diffusionBytes,
        options.vaeArchitecture,
        loraPaths,
        loraWeights.toDoubleArray(),
        options.width,
        options.height,
        options.samplingPreset,
        options.steps,
        options.cfgScale,
        options.seed,
        options.upscalerType,
        options.upscaleFactor,
        options.hiresSteps,
        options.hiresDenoisingStrength,
        outputFile.absolutePath,
        diagnosticFile.absolutePath
      )
    }.runOnQueue(nativeOperationQueue)
  }

  private fun generationDiagnosticFile(context: Context): File {
    return File(context.filesDir, "diagnostics/generation-run.json")
  }

  private fun lastCrashReportFile(context: Context): File {
    return File(context.filesDir, "diagnostics/last-crash.json")
  }

  private fun consumeInterruptedGeneration(context: Context): String? {
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
    breadcrumb.put("schemaVersion", 2)
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
    report.put("schemaVersion", 2)
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
    Log.i(
      "StableDiffusionBridge",
      "[crash] $title stage=$stage exit=$reason vulkan=${breadcrumb.optString("vulkanApi")} family=${breadcrumb.optString("family")} lora=${breadcrumb.optInt("loraCount")} symbol=${topSymbol ?: "none"}"
    )
    return report.toString()
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
