package expo.modules.stablediffusion

import ai.onnxruntime.NodeInfo
import ai.onnxruntime.OnnxJavaType
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import ai.onnxruntime.TensorInfo
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

internal object OnnxPipelineInspector {
  private val sessionFiles =
    listOf(
      "text_encoder" to "text_encoder/model.ort",
      "unet" to "unet/model.ort",
      "vae_decoder" to "vae_decoder/model.ort",
    )
  private val tokenizerFiles =
    listOf(
      "tokenizer/vocab.json",
      "tokenizer/merges.txt",
      "tokenizer/tokenizer_config.json",
    )

  fun inspect(filesDir: File, externalFilesDir: File?): JSONObject {
    val root = resolveRoot(filesDir, externalFilesDir)
    val missing = requiredFiles().filterNot { File(root, it).isFile }
    if (missing.isNotEmpty()) {
      return JSONObject()
        .put("ok", false)
        .put("rootPath", root.absolutePath)
        .put("missing", JSONArray(missing))
    }

    val environment = OrtEnvironment.getEnvironment()
    val sessions = JSONArray()
    OrtSession.SessionOptions().use { options ->
      for ((role, relativePath) in sessionFiles) {
        environment.createSession(File(root, relativePath).absolutePath, options).use { session ->
          sessions.put(
            JSONObject()
              .put("role", role)
              .put("relativePath", relativePath)
              .put("inputs", tensorsJson(session.inputInfo))
              .put("outputs", tensorsJson(session.outputInfo)),
          )
        }
      }
    }

    return JSONObject()
      .put("ok", true)
      .put("rootPath", root.absolutePath)
      .put("sessions", sessions)
  }

  private fun resolveRoot(filesDir: File, externalFilesDir: File?): File {
    val externalRoot = externalFilesDir?.let { File(it, "poc-chilloutmix") }
    if (externalRoot != null && requiredFiles().any { File(externalRoot, it).isFile }) {
      return externalRoot
    }
    return File(filesDir, "poc-chilloutmix")
  }

  private fun requiredFiles(): List<String> = sessionFiles.map { it.second } + tokenizerFiles

  private fun tensorsJson(info: Map<String, NodeInfo>): JSONArray {
    val tensors = JSONArray()
    for ((name, node) in info) {
      val tensor = node.info as? TensorInfo ?: continue
      val shape = JSONArray()
      tensor.shape.forEach { shape.put(it) }
      tensors.put(
        JSONObject()
          .put("name", name)
          .put("type", typeName(tensor.type))
          .put("shape", shape),
      )
    }
    return tensors
  }

  private fun typeName(type: OnnxJavaType): String =
    when (type.name) {
      "FLOAT" -> "float32"
      "FLOAT16" -> "float16"
      "DOUBLE" -> "float64"
      "INT8" -> "int8"
      "INT16" -> "int16"
      "INT32" -> "int32"
      "INT64" -> "int64"
      "UINT8" -> "uint8"
      "BOOL" -> "bool"
      "STRING" -> "string"
      else -> type.name.lowercase()
    }
}
