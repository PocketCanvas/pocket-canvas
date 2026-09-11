package expo.modules.stablediffusion

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord

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
  @Field val vaeArchitecture: String,
  @Field val backend: String
) : Record

internal fun GenerationOptions.validate(loraUris: List<String>, loraWeights: List<Double>) {
  require(steps in 1..100) { "Steps must be between 1 and 100" }
  require(width in 64..2048 && height in 64..2048) { "Image size must be between 64 and 2048" }
  require(samplingPreset.isNotBlank()) { "Sampling preset must not be blank" }
  require(cfgScale.isFinite() && cfgScale in 0.0..30.0) { "CFG scale must be between 0 and 30" }
  require(seed >= -1) { "Seed must be -1 or greater" }
  require(upscalerType.isNotBlank()) { "Upscaler type must not be blank" }
  require(upscaleFactor.isFinite() && upscaleFactor in 1.5..4.0 && upscaleFactor * 2 % 1 == 0.0) {
    "Upscale factor must be between 1.5 and 4.0 in 0.5 increments"
  }
  require(hiresSteps in 0..100) { "Hires steps must be between 0 and 100" }
  require(hiresDenoisingStrength.isFinite() && hiresDenoisingStrength in 0.0001..1.0) {
    "Hires denoising strength must be between 0.0001 and 1"
  }
  require(modelFamily in setOf("sd1", "sdxl", "anima", "unknown")) { "Unsupported model family" }
  require(modelFamilyEvidence in setOf("tensor-signature", "insufficient")) { "Unsupported family evidence" }
  require(modelVariant in setOf("turbo", "unknown")) { "Unsupported model variant" }
  require(modelVariantEvidence in setOf("gguf-metadata", "safetensors-metadata", "original-file-name", "alias", "insufficient")) {
    "Unsupported variant evidence"
  }
  require(diffusionStorage in setOf("f32", "f16", "bf16", "f8", "q4", "q5", "q8", "mixed", "unknown")) {
    "Unsupported diffusion storage"
  }
  require(diffusionBytes.isFinite() && diffusionBytes >= 0.0) { "Invalid diffusion byte estimate" }
  require(vaeArchitecture in setOf("autoencoder-kl", "unknown")) { "Unsupported VAE architecture" }
  require(backend in setOf("vulkan", "opencl")) { "Unsupported inference backend" }
  require(loraUris.size == loraWeights.size) { "LoRA paths and weights must match" }
  require(loraWeights.all { it.isFinite() && it in 0.0..2.0 }) {
    "LoRA weights must be between 0 and 2"
  }
}
