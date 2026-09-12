package expo.modules.stablediffusion

import kotlin.math.sqrt

internal class DdimScheduler(
  private val trainSteps: Int = 1000,
  betaStart: Double = 0.00085,
  betaEnd: Double = 0.012,
) {
  private val alphasCumprod: DoubleArray =
    DoubleArray(trainSteps).also { values ->
      var product = 1.0
      val start = sqrt(betaStart)
      val end = sqrt(betaEnd)
      for (i in 0 until trainSteps) {
        val t = if (trainSteps == 1) 0.0 else i / (trainSteps - 1.0)
        val beta = (start * (1.0 - t) + end * t).let { it * it }
        product *= 1.0 - beta
        values[i] = product
      }
    }

  fun timesteps(steps: Int): IntArray {
    require(steps in 1..trainSteps)
    val ratio = trainSteps / steps
    return IntArray(steps) { index -> (steps - 1 - index) * ratio + 1 }
  }

  fun step(sample: FloatArray, modelOutput: FloatArray, timestep: Int, steps: Int): FloatArray {
    val ratio = trainSteps / steps
    val previous = timestep - ratio
    val alphaT = alphasCumprod[timestep.coerceIn(0, trainSteps - 1)]
    val alphaPrev =
      if (previous >= 0) alphasCumprod[previous.coerceIn(0, trainSteps - 1)] else alphasCumprod[0]
    val sqrtAlphaT = sqrt(alphaT)
    val sqrtBetaT = sqrt(1.0 - alphaT)
    val sqrtAlphaPrev = sqrt(alphaPrev)
    val sqrtOneMinusAlphaPrev = sqrt(1.0 - alphaPrev)
    val next = FloatArray(sample.size)
    for (i in sample.indices) {
      val predicted = (sample[i] - sqrtBetaT * modelOutput[i]) / sqrtAlphaT
      next[i] = (sqrtAlphaPrev * predicted + sqrtOneMinusAlphaPrev * modelOutput[i]).toFloat()
    }
    return next
  }
}
