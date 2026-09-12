package expo.modules.stablediffusion

import java.io.File

internal object OnnxPocFiles {
  const val DIRECTORY_NAME = "poc-chilloutmix"

  val sessionFiles =
    listOf(
      "text_encoder" to "text_encoder/model.ort",
      "unet" to "unet/model.ort",
      "vae_decoder" to "vae_decoder/model.ort",
    )

  val tokenizerFiles =
    listOf(
      "tokenizer/vocab.json",
      "tokenizer/merges.txt",
      "tokenizer/tokenizer_config.json",
    )

  fun requiredFiles(): List<String> = sessionFiles.map { it.second } + tokenizerFiles

  fun resolveRoot(filesDir: File, externalFilesDir: File?): File {
    val externalRoot = externalFilesDir?.let { File(it, DIRECTORY_NAME) }
    if (externalRoot != null && requiredFiles().any { File(externalRoot, it).isFile }) {
      return externalRoot
    }
    return File(filesDir, DIRECTORY_NAME)
  }

  fun requireRoot(filesDir: File, externalFilesDir: File?): File {
    val root = resolveRoot(filesDir, externalFilesDir)
    val missing = requiredFiles().filterNot { File(root, it).isFile }
    require(missing.isEmpty()) { "빠진 ONNX 파일: ${missing.joinToString()}" }
    return root
  }
}
