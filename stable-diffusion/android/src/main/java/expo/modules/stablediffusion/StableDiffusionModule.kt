package expo.modules.stablediffusion

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
    loraPath: String,
    outputPath: String
  ): String

  override fun definition() = ModuleDefinition {
    Name("StableDiffusion")

    Function("getSystemInfo") {
      return@Function getSystemInfo()
    }

    AsyncFunction("generateImage") { prompt: String ->
      val context = appContext.reactContext ?: throw Exception("React context not found")

      // Hardcoded path to the model in internal storage
      val modelPath = File(context.filesDir, "v1-5-pruned-emaonly-q4_k.gguf").absolutePath
      val loraPath = File(context.filesDir, "lcm-lora-sdv1-5.safetensors").absolutePath

      // Temporary path for the output image
      val outputPath = File(context.cacheDir, "output.png").absolutePath

      return@AsyncFunction generateImage(prompt, modelPath, loraPath, outputPath)
    }
  }
}
