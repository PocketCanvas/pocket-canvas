package expo.modules.stablediffusion

import android.net.Uri
import androidx.annotation.Keep
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord
import java.io.File
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel

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
  @Field val hiresDenoisingStrength: Double
) : Record

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
    outputPath: String
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

      return@AsyncFunction generateImage(
        prompt.trim(),
        options.negativePrompt.trim(),
        modelPath,
        taesdPath,
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
        outputFile.absolutePath
      )
    }.runOnQueue(nativeOperationQueue)
  }

}
