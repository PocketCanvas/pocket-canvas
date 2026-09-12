package expo.modules.stablediffusion

import org.json.JSONObject
import java.io.File
import java.util.regex.Pattern

internal class ClipTokenizer(vocabFile: File, mergesFile: File) {
  private val encoder: Map<String, Int>
  private val bpeRanks: Map<Pair<String, String>, Int>
  private val byteEncoder: Map<Int, Char> = bytesToUnicode()
  private val cache = HashMap<String, String>()
  private val bos: Int
  private val eos: Int
  private val unk: Int
  private val pattern: Pattern =
    Pattern.compile(
      """'s|'t|'re|'ve|'m|'ll|'d|[\p{L}]+|[\p{N}]|[^\s\p{L}\p{N}]+""",
      Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CHARACTER_CLASS,
    )

  init {
    val vocab = JSONObject(vocabFile.readText())
    encoder =
      buildMap {
        val keys = vocab.keys()
        while (keys.hasNext()) {
          val token = keys.next()
          put(token, vocab.getInt(token))
        }
      }
    bos = encoder["<|startoftext|>"] ?: error("vocab에 <|startoftext|> 가 없습니다")
    eos = encoder["<|endoftext|>"] ?: error("vocab에 <|endoftext|> 가 없습니다")
    unk = encoder["<|endoftext|>"] ?: bos

    val ranks = HashMap<Pair<String, String>, Int>()
    mergesFile.bufferedReader().useLines { lines ->
      var rank = 0
      for (line in lines) {
        if (line.isBlank() || line.startsWith("#")) continue
        val parts = line.split(' ')
        if (parts.size != 2) continue
        ranks[parts[0] to parts[1]] = rank
        rank += 1
      }
    }
    bpeRanks = ranks
  }

  fun encode(text: String, maxLength: Int = 77): IntArray {
    val tokens = ArrayList<Int>(maxLength)
    tokens.add(bos)
    val cleaned = text.lowercase().replace(WHITESPACE, " ").trim()
    val matcher = pattern.matcher(cleaned)
    while (matcher.find() && tokens.size < maxLength - 1) {
      val encodedBytes =
        matcher.group().toByteArray(Charsets.UTF_8).joinToString("") { byte ->
          byteEncoder[byte.toInt() and 0xFF].toString()
        }
      for (piece in bpe(encodedBytes).split(' ')) {
        tokens.add(encoder[piece] ?: unk)
        if (tokens.size >= maxLength - 1) break
      }
    }
    tokens.add(eos)
    while (tokens.size < maxLength) tokens.add(eos)
    return tokens.take(maxLength).toIntArray()
  }

  private fun bpe(token: String): String {
    cache[token]?.let { return it }
    if (token.isEmpty()) return token
    var word: List<String> = token.dropLast(1).map { it.toString() } + (token.last() + "</w>")
    var pairs = pairsOf(word)
    if (pairs.isEmpty()) {
      val result = "$token</w>"
      cache[token] = result
      return result
    }
    while (true) {
      val bigram = pairs.minBy { bpeRanks[it] ?: Int.MAX_VALUE }
      if (bigram !in bpeRanks) break
      val (first, second) = bigram
      val next = ArrayList<String>()
      var i = 0
      while (i < word.size) {
        val j = (i until word.size).firstOrNull { word[it] == first } ?: word.size
        next.addAll(word.subList(i, j))
        i = j
        if (i >= word.size) break
        if (i < word.size - 1 && word[i] == first && word[i + 1] == second) {
          next.add(first + second)
          i += 2
        } else {
          next.add(word[i])
          i += 1
        }
      }
      word = next
      if (word.size == 1) break
      pairs = pairsOf(word)
    }
    val joined = word.joinToString(" ")
    cache[token] = joined
    return joined
  }

  private fun pairsOf(word: List<String>): Set<Pair<String, String>> {
    if (word.size < 2) return emptySet()
    return (0 until word.size - 1).mapTo(LinkedHashSet()) { word[it] to word[it + 1] }
  }

  private fun bytesToUnicode(): Map<Int, Char> {
    val bs = ArrayList<Int>(256)
    bs.addAll(33..126)
    bs.addAll(161..172)
    bs.addAll(174..255)
    val original = bs.toSet()
    val cs = ArrayList(bs)
    var n = 0
    for (b in 0 until 256) {
      if (b !in original) {
        bs.add(b)
        cs.add(256 + n)
        n += 1
      }
    }
    return bs.indices.associate { bs[it] to cs[it].toChar() }
  }

  companion object {
    private val WHITESPACE = Regex("\\s+")
  }
}
