package expo.modules.stablediffusion

import androidx.annotation.Keep
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel

class StableDiffusionModule : Module() {
  private val nativeOperationQueue = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  companion object {
    init {
      System.loadLibrary("stable_diffusion_bridge")
    }
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
    diagnosticPath: String,
    inferenceBackend: String
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
    Events("onProgress", "onQuantizationProgress", "onOnnxPocProgress")
    OnDestroy { nativeOperationQueue.cancel() }

    Function("getSystemInfo") {
      return@Function getSystemInfo()
    }

    AsyncFunction("consumeInterruptedGeneration") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      GenerationCrashReporter.consume(context)
    }

    AsyncFunction("inspectOnnxPipeline") {
      val context = appContext.reactContext ?: throw Exception("React context not found")
      try {
        OnnxPipelineInspector.inspect(context.filesDir, context.getExternalFilesDir(null)).toString()
      } catch (error: Exception) {
        org.json.JSONObject()
          .put("ok", false)
          .put("rootPath", org.json.JSONObject.NULL)
          .put("missing", org.json.JSONArray())
          .put("error", error.message ?: "ONNX 파이프라인을 열지 못했습니다.")
          .toString()
      }
    }.runOnQueue(nativeOperationQueue)

    AsyncFunction("generateOnnxPoc") {
        prompt: String,
        negativePrompt: String,
        width: Int,
        height: Int,
        steps: Int,
        cfgScale: Double,
        seed: Long ->
      val context = appContext.reactContext ?: throw Exception("React context not found")
      try {
        OnnxPocGenerator.generate(
          context.filesDir,
          context.getExternalFilesDir(null),
          prompt,
          negativePrompt,
          width,
          height,
          steps,
          cfgScale,
          seed,
        ) { stage, step, currentSteps ->
          sendEvent(
            "onOnnxPocProgress",
            mapOf("stage" to stage, "step" to step, "steps" to currentSteps),
          )
        }.toString()
      } catch (error: Exception) {
        org.json.JSONObject()
          .put("ok", false)
          .put("error", error.message ?: "ONNX 생성에 실패했습니다.")
          .toString()
      }
    }.runOnQueue(nativeOperationQueue)

    AsyncFunction("quantizeModel") { inputUri: String, outputUri: String, type: String ->
      val context = appContext.reactContext ?: throw Exception("React context not found")
      val supportedTypes = setOf("q8_0", "q5_0", "q5_1", "q4_0", "q4_1", "q4_K")
      require(type in supportedTypes) { "Unsupported quantization type" }

      val appStorage = AppStorageFiles(context)
      val inputFile = appStorage.resolve(inputUri)
      val outputFile = appStorage.resolve(outputUri)
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
      options.validate(loraUris, loraWeights)

      val appStorage = AppStorageFiles(context)
      val modelPath = appStorage.resolve(modelUri, mustExist = true).absolutePath
      val taesdPath = if (taesdUri.isBlank()) "" else appStorage.resolve(taesdUri, mustExist = true).absolutePath
      val loraPaths = loraUris.map { appStorage.resolve(it, mustExist = true).absolutePath }.toTypedArray()
      val outputFile = appStorage.resolve(outputUri)
      require(outputFile.parentFile?.isDirectory == true) { "Output directory not found" }
      val diagnosticFile = GenerationCrashReporter.diagnosticFile(context)
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
        diagnosticFile.absolutePath,
        options.inferenceBackend
      )
    }.runOnQueue(nativeOperationQueue)
  }
}
