package expo.modules.stablediffusion

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class StableDiffusionModule : Module() {

  companion object {
    init {
      System.loadLibrary("stable_diffusion_bridge")
    }
  }

  private external fun getSystemInfo(): String

  override fun definition() = ModuleDefinition {
    Name("StableDiffusion")

    Function("getSystemInfo") {
      return@Function getSystemInfo()
    }
  }
}
