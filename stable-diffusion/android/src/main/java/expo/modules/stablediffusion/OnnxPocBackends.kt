package expo.modules.stablediffusion

import ai.onnxruntime.OrtSession

internal object OnnxPocBackends {
  val supported = setOf("cpu", "xnnpack", "nnapi")

  fun requireSupported(backend: String): String {
    require(backend in supported) { "Unsupported ONNX backend: $backend" }
    return backend
  }

  fun apply(options: OrtSession.SessionOptions, backend: String) {
    when (requireSupported(backend)) {
      "cpu" -> Unit
      "xnnpack" -> options.addXnnpack(emptyMap())
      "nnapi" -> options.addNnapi()
    }
  }
}
