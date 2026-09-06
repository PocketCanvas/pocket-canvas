package expo.modules.stablediffusion

internal data class NativeCrashFrame(
  val library: String,
  val pc: String,
  val relPc: String,
  val symbol: String,
  val symbolOffset: Long,
  val buildId: String
)

internal data class TombstoneSignal(
  val number: Int,
  val name: String,
  val code: Int,
  val codeName: String,
  val faultAddress: String
)

internal data class TombstoneTrace(
  val frames: List<NativeCrashFrame>,
  val signal: TombstoneSignal?
)

internal object TombstoneTraceParser {
  private val skipSymbol = Regex("^(Java_expo|art::|kotlin|__start_thread|__pthread_start)")

  fun parse(bytes: ByteArray): TombstoneTrace {
    if (bytes.isEmpty()) return TombstoneTrace(emptyList(), null)
    if (looksLikeText(bytes)) return parseText(bytes)
    val proto = parseProto(bytes)
    return if (proto.frames.isEmpty()) parseText(bytes) else proto
  }

  fun topSymbol(frames: List<NativeCrashFrame>): String? {
    for (frame in frames) {
      val symbol = frame.symbol.replace(Regex("\\+\\d+$"), "")
      if (symbol.isEmpty() || symbol == "unknown") continue
      if (skipSymbol.containsMatchIn(symbol)) continue
      return symbol
    }
    return null
  }

  private fun looksLikeText(bytes: ByteArray): Boolean {
    val head = bytes.decodeToString(0, minOf(bytes.size, 64))
    return Regex("^\\s*(\\*\\*\\*|tombstone|Build fingerprint|#\\d+)", RegexOption.IGNORE_CASE)
      .containsMatchIn(head)
  }

  private fun parseText(bytes: ByteArray): TombstoneTrace {
    val text = bytes.decodeToString()
    val pattern = Regex("^#\\d+\\s+pc\\s+([0-9a-fA-Fx]+)\\s+(\\S+)(?:\\s+\\((.+)\\))?")
    val frames = text.lineSequence().mapNotNull { line ->
      val match = pattern.find(line.trim()) ?: return@mapNotNull null
      val detail = match.groupValues.getOrElse(3) { "" }
      val offset = Regex("\\+(\\d+)\\s*$").find(detail)?.groupValues?.get(1)?.toLongOrNull() ?: 0L
      val buildId = Regex("BuildId:\\s*([0-9a-fA-F]+)", RegexOption.IGNORE_CASE).find(detail)?.groupValues?.get(1) ?: ""
      val symbol = detail.replace(Regex("\\+\\d+\\s*$"), "").replace(Regex("\\s*\\(BuildId:.*$", RegexOption.IGNORE_CASE), "").trim()
      val relPc = if (match.groupValues[1].startsWith("0x")) match.groupValues[1] else "0x${match.groupValues[1]}"
      NativeCrashFrame(
        library = libraryBasename(match.groupValues[2]),
        pc = relPc,
        relPc = relPc,
        symbol = symbol,
        symbolOffset = offset,
        buildId = buildId
      )
    }.take(16).toList()
    return TombstoneTrace(frames, parseTextSignal(text))
  }

  private fun parseTextSignal(text: String): TombstoneSignal? {
    val match = Regex(
      "signal\\s+(\\d+)\\s+\\(([^)]+)\\)(?:,\\s+code\\s+(\\d+)\\s+\\(([^)]+)\\))?(?:,\\s+fault addr\\s+(0x[0-9a-fA-F]+|0+))?",
      RegexOption.IGNORE_CASE
    ).find(text) ?: return null
    return TombstoneSignal(
      number = match.groupValues[1].toInt(),
      name = match.groupValues[2],
      code = match.groupValues[3].toIntOrNull() ?: 0,
      codeName = match.groupValues[4],
      faultAddress = match.groupValues.getOrElse(5) { "0x0" }.ifEmpty { "0x0" }
    )
  }

  private fun parseProto(bytes: ByteArray): TombstoneTrace {
    val reader = ProtoReader(bytes)
    var tid = 0
    var signal: TombstoneSignal? = null
    val threads = mutableListOf<Pair<Int, List<NativeCrashFrame>>>()
    while (reader.remaining()) {
      val tag = reader.readVarint().toInt()
      val field = tag ushr 3
      val wire = tag and 7
      when {
        field == 6 && wire == 0 -> tid = reader.readVarint().toInt()
        field == 10 && wire == 2 -> signal = parseSignal(reader.readBytes())
        field == 16 && wire == 2 -> {
          val thread = parseMapEntry(reader.readBytes())
          if (thread != null) threads.add(thread)
        }
        else -> reader.skip(wire)
      }
    }
    val crashing = threads.firstOrNull { it.first == tid } ?: threads.firstOrNull { it.second.isNotEmpty() }
    return TombstoneTrace(crashing?.second?.take(16).orEmpty(), signal)
  }

  private fun parseSignal(bytes: ByteArray): TombstoneSignal {
    val reader = ProtoReader(bytes)
    var number = 0
    var name = ""
    var code = 0
    var codeName = ""
    var faultAddress = 0L
    while (reader.remaining()) {
      val tag = reader.readVarint().toInt()
      val field = tag ushr 3
      val wire = tag and 7
      when {
        field == 1 && wire == 0 -> number = reader.readVarint().toInt()
        field == 2 && wire == 2 -> name = reader.readString()
        field == 3 && wire == 0 -> code = reader.readVarint().toInt()
        field == 4 && wire == 2 -> codeName = reader.readString()
        field == 9 && wire == 0 -> faultAddress = reader.readVarint()
        else -> reader.skip(wire)
      }
    }
    return TombstoneSignal(number, name, code, codeName, "0x${java.lang.Long.toHexString(faultAddress)}")
  }

  private fun parseMapEntry(bytes: ByteArray): Pair<Int, List<NativeCrashFrame>>? {
    val reader = ProtoReader(bytes)
    var key = 0
    var frames = emptyList<NativeCrashFrame>()
    var threadId = 0
    while (reader.remaining()) {
      val tag = reader.readVarint().toInt()
      val field = tag ushr 3
      val wire = tag and 7
      when {
        field == 1 && wire == 0 -> key = reader.readVarint().toInt()
        field == 2 && wire == 2 -> {
          val thread = parseThread(reader.readBytes())
          threadId = thread.first
          frames = thread.second
        }
        else -> reader.skip(wire)
      }
    }
    val id = if (threadId != 0) threadId else key
    return if (frames.isEmpty() && id == 0) null else id to frames
  }

  private fun parseThread(bytes: ByteArray): Pair<Int, List<NativeCrashFrame>> {
    val reader = ProtoReader(bytes)
    var id = 0
    val frames = mutableListOf<NativeCrashFrame>()
    while (reader.remaining()) {
      val tag = reader.readVarint().toInt()
      val field = tag ushr 3
      val wire = tag and 7
      when {
        field == 1 && wire == 0 -> id = reader.readVarint().toInt()
        field == 4 && wire == 2 -> frames.add(parseFrame(reader.readBytes()))
        else -> reader.skip(wire)
      }
    }
    return id to frames
  }

  private fun parseFrame(bytes: ByteArray): NativeCrashFrame {
    val reader = ProtoReader(bytes)
    var relPc = 0L
    var pc = 0L
    var symbol = ""
    var fileName = ""
    var functionOffset = 0L
    var buildId = ""
    while (reader.remaining()) {
      val tag = reader.readVarint().toInt()
      val field = tag ushr 3
      val wire = tag and 7
      when {
        field == 1 && wire == 0 -> relPc = reader.readVarint()
        field == 2 && wire == 0 -> pc = reader.readVarint()
        field == 4 && wire == 2 -> symbol = reader.readString()
        field == 5 && wire == 0 -> functionOffset = reader.readVarint()
        field == 6 && wire == 2 -> fileName = reader.readString()
        field == 8 && wire == 2 -> buildId = reader.readString()
        else -> reader.skip(wire)
      }
    }
    val address = if (pc != 0L) pc else relPc
    return NativeCrashFrame(
      library = libraryBasename(fileName),
      pc = "0x${java.lang.Long.toHexString(address)}",
      relPc = "0x${java.lang.Long.toHexString(relPc)}",
      symbol = symbol,
      symbolOffset = functionOffset,
      buildId = buildId
    )
  }

  private fun libraryBasename(path: String): String {
    val bang = path.lastIndexOf('!')
    val sliced = if (bang >= 0) path.substring(bang + 1) else path
    val slash = maxOf(sliced.lastIndexOf('/'), sliced.lastIndexOf('\\'))
    val name = if (slash >= 0) sliced.substring(slash + 1) else sliced
    return name.replace(Regex("/data/data/[^/\\s]+/files/\\S+"), "<app-file>")
  }
}

private class ProtoReader(private val data: ByteArray) {
  var pos = 0

  fun remaining() = pos < data.size

  fun readVarint(): Long {
    var result = 0L
    var shift = 0
    while (pos < data.size) {
      val byte = data[pos++].toInt() and 0xff
      result = result or ((byte and 0x7f).toLong() shl shift)
      if (byte and 0x80 == 0) return result
      shift += 7
      if (shift > 63) break
    }
    return result
  }

  fun readBytes(): ByteArray {
    val length = readVarint().toInt().coerceAtLeast(0)
    val start = pos
    pos = (start + length).coerceAtMost(data.size)
    return data.copyOfRange(start, pos)
  }

  fun readString(): String = readBytes().decodeToString()

  fun skip(wire: Int) {
    when (wire) {
      0 -> readVarint()
      1 -> pos += 8
      2 -> readBytes()
      5 -> pos += 4
    }
  }
}
