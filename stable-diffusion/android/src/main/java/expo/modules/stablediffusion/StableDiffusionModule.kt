package expo.modules.stablediffusion

import android.net.Uri
import androidx.annotation.Keep
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class StableDiffusionModule : Module() {

  companion object {
    init {
      System.loadLibrary("stable_diffusion_bridge")
    }
  }

  private external fun getSystemInfo(): String
  private external fun generateImage(
    prompt: String,
    modelPath: String,
    loraPaths: Array<String>,
    loraWeights: DoubleArray,
    steps: Int,
    outputPath: String
  ): String

  @Keep
  private fun emitProgress(stage: String, step: Int, steps: Int) {
    sendEvent("onProgress", mapOf("stage" to stage, "step" to step, "steps" to steps))
  }

  override fun definition() = ModuleDefinition {
    Name("StableDiffusion")
    Events("onProgress")

    Function("getSystemInfo") {
      return@Function getSystemInfo()
    }

    AsyncFunction("generateImage") {
        prompt: String,
        modelUri: String,
        loraUris: List<String>,
        loraWeights: List<Double>,
        steps: Int,
        outputUri: String ->
      val context = appContext.reactContext ?: throw Exception("React context not found")
      require(prompt.isNotBlank()) { "Prompt must not be blank" }
      require(steps in 1..100) { "Steps must be between 1 and 100" }
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
      val loraPaths = loraUris.map { appFile(it, true).absolutePath }.toTypedArray()
      val outputFile = appFile(outputUri, false)
      require(outputFile.parentFile?.isDirectory == true) { "Output directory not found" }

      return@AsyncFunction generateImage(
        prompt.trim(),
        modelPath,
        loraPaths,
        loraWeights.toDoubleArray(),
        steps,
        outputFile.absolutePath
      )
    }
  }
}
