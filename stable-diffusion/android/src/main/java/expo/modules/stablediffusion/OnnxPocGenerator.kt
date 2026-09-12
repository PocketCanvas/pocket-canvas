package expo.modules.stablediffusion

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.graphics.Bitmap
import android.graphics.Color
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.Random

internal object OnnxPocGenerator {
  private const val LATENT_CHANNELS = 4
  private const val LATENT_SCALE = 8
  private const val VAE_SCALING = 0.18215f
  private const val SEQUENCE = 77

  fun generate(
    filesDir: File,
    externalFilesDir: File?,
    prompt: String,
    negativePrompt: String,
    width: Int,
    height: Int,
    steps: Int,
    cfgScale: Double,
    seed: Long,
    onProgress: (stage: String, step: Int, steps: Int) -> Unit,
  ): JSONObject {
    require(width in 64..512 && width % 8 == 0) { "width must be a multiple of 8 between 64 and 512" }
    require(height in 64..512 && height % 8 == 0) { "height must be a multiple of 8 between 64 and 512" }
    require(steps in 1..30) { "steps must be between 1 and 30" }
    require(prompt.isNotBlank()) { "prompt must not be blank" }

    val root = OnnxPocFiles.requireRoot(filesDir, externalFilesDir)
    val output = File(filesDir, "poc-onnx-output.png")
    val environment = OrtEnvironment.getEnvironment()
    val scheduler = DdimScheduler()
    val latentWidth = width / LATENT_SCALE
    val latentHeight = height / LATENT_SCALE
    val latentSize = LATENT_CHANNELS * latentHeight * latentWidth
    val rng = Random(seed)
    val started = System.nanoTime()

    onProgress("encoding", 0, steps)
    val tokenizer =
      ClipTokenizer(File(root, "tokenizer/vocab.json"), File(root, "tokenizer/merges.txt"))
    val positiveIds = tokenizer.encode(prompt)
    val negativeIds = tokenizer.encode(negativePrompt)
    val positiveHidden: FloatArray
    val negativeHidden: FloatArray
    session(environment, File(root, "text_encoder/model.ort")).use { textEncoder ->
      positiveHidden = encodeText(environment, textEncoder, positiveIds)
      negativeHidden = encodeText(environment, textEncoder, negativeIds)
    }
    val hiddenSize = positiveHidden.size / SEQUENCE

    var latents = FloatArray(latentSize) { rng.nextGaussian().toFloat() }
    val timesteps = scheduler.timesteps(steps)
    onProgress("sampling", 0, steps)
    session(environment, File(root, "unet/model.ort")).use { unet ->
      for ((index, timestep) in timesteps.withIndex()) {
        val uncond =
          runUnet(environment, unet, latents, negativeHidden, hiddenSize, timestep, latentHeight, latentWidth)
        val cond =
          runUnet(environment, unet, latents, positiveHidden, hiddenSize, timestep, latentHeight, latentWidth)
        val guided = FloatArray(latentSize) { i ->
          (uncond[i] + cfgScale.toFloat() * (cond[i] - uncond[i]))
        }
        latents = scheduler.step(latents, guided, timestep, steps)
        onProgress("sampling", index + 1, steps)
      }
    }

    onProgress("decoding", steps, steps)
    for (i in latents.indices) latents[i] /= VAE_SCALING
    val rgb: FloatArray
    val outWidth: Int
    val outHeight: Int
    session(environment, File(root, "vae_decoder/model.ort")).use { vae ->
      val decoded = runVae(environment, vae, latents, latentHeight, latentWidth)
      rgb = decoded.pixels
      outWidth = decoded.width
      outHeight = decoded.height
    }
    writePng(output, rgb, outWidth, outHeight)

    return JSONObject()
      .put("ok", true)
      .put("outputPath", output.absolutePath)
      .put("width", outWidth)
      .put("height", outHeight)
      .put("steps", steps)
      .put("elapsedMs", (System.nanoTime() - started) / 1_000_000)
  }

  private fun session(environment: OrtEnvironment, file: File): OrtSession {
    OrtSession.SessionOptions().use { options ->
      options.setIntraOpNumThreads(Runtime.getRuntime().availableProcessors().coerceAtMost(4))
      return environment.createSession(file.absolutePath, options)
    }
  }

  private fun encodeText(
    environment: OrtEnvironment,
    session: OrtSession,
    tokenIds: IntArray,
  ): FloatArray {
    intTensor(environment, tokenIds, longArrayOf(1, tokenIds.size.toLong())).use { ids ->
      session.run(mapOf("input_ids" to ids)).use { result ->
        val tensor = result.get("last_hidden_state").get() as OnnxTensor
        return tensor.floatBuffer.let { buffer ->
          val values = FloatArray(buffer.remaining())
          buffer.get(values)
          values
        }
      }
    }
  }

  private fun runUnet(
    environment: OrtEnvironment,
    session: OrtSession,
    latents: FloatArray,
    hidden: FloatArray,
    hiddenSize: Int,
    timestep: Int,
    latentHeight: Int,
    latentWidth: Int,
  ): FloatArray {
    val sample =
      floatTensor(environment, latents, longArrayOf(1, LATENT_CHANNELS.toLong(), latentHeight.toLong(), latentWidth.toLong()))
    val time = intTensor(environment, intArrayOf(timestep), longArrayOf(1))
    val states =
      floatTensor(environment, hidden, longArrayOf(1, SEQUENCE.toLong(), hiddenSize.toLong()))
    sample.use {
      time.use {
        states.use {
          session.run(
            mapOf(
              "sample" to sample,
              "timestep" to time,
              "encoder_hidden_states" to states,
            ),
          ).use { result ->
            val tensor = result.get("out_sample").get() as OnnxTensor
            val buffer = tensor.floatBuffer
            val values = FloatArray(buffer.remaining())
            buffer.get(values)
            return values
          }
        }
      }
    }
  }

  private fun runVae(
    environment: OrtEnvironment,
    session: OrtSession,
    latents: FloatArray,
    latentHeight: Int,
    latentWidth: Int,
  ): DecodedImage {
    val input =
      floatTensor(
        environment,
        latents,
        longArrayOf(1, LATENT_CHANNELS.toLong(), latentHeight.toLong(), latentWidth.toLong()),
      )
    input.use {
      session.run(mapOf("latent_sample" to input)).use { result ->
        val tensor = result.get("sample").get() as OnnxTensor
        val shape = tensor.info.shape
        val height = shape[2].toInt()
        val width = shape[3].toInt()
        val buffer = tensor.floatBuffer
        val values = FloatArray(buffer.remaining())
        buffer.get(values)
        return DecodedImage(values, width, height)
      }
    }
  }

  private fun writePng(file: File, chw: FloatArray, width: Int, height: Int) {
    val pixels = IntArray(width * height)
    for (y in 0 until height) {
      for (x in 0 until width) {
        val red = toByte(chw[y * width + x])
        val green = toByte(chw[height * width + y * width + x])
        val blue = toByte(chw[2 * height * width + y * width + x])
        pixels[y * width + x] = Color.argb(255, red, green, blue)
      }
    }
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    bitmap.setPixels(pixels, 0, width, 0, 0, width, height)
    FileOutputStream(file).use { stream ->
      check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)) { "PNG 저장에 실패했습니다." }
    }
    bitmap.recycle()
  }

  private fun toByte(value: Float): Int = ((value * 0.5f + 0.5f).coerceIn(0f, 1f) * 255f).toInt()

  private fun floatTensor(environment: OrtEnvironment, data: FloatArray, shape: LongArray): OnnxTensor {
    val buffer =
      ByteBuffer.allocateDirect(data.size * 4).order(ByteOrder.nativeOrder()).asFloatBuffer()
    buffer.put(data)
    buffer.rewind()
    return OnnxTensor.createTensor(environment, buffer, shape)
  }

  private fun intTensor(environment: OrtEnvironment, data: IntArray, shape: LongArray): OnnxTensor {
    val buffer =
      ByteBuffer.allocateDirect(data.size * 4).order(ByteOrder.nativeOrder()).asIntBuffer()
    buffer.put(data)
    buffer.rewind()
    return OnnxTensor.createTensor(environment, buffer, shape)
  }

  private data class DecodedImage(val pixels: FloatArray, val width: Int, val height: Int)
}
