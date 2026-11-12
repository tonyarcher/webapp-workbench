package stockgame.parse

import com.fasterxml.jackson.databind.JsonNode
import stockgame.ai.DecisionBackend
import stockgame.ai.jsonBody

const val PARSE_THRESHOLD: Double = 0.5

/** One parsed order suggestion. Slots stay null when extraction finds nothing. */
data class ParsedOrder(val intent: Boolean, val side: String, val symbol: String?, val qty: Int?, val method: String)

private val SIDE_CHOICES = listOf("buy", "sell", "unknown")

private val STOP_WORDS = setOf(
    "buy", "sell", "short", "cover", "market", "limit", "stop", "day", "gtc",
    "shares", "share", "stock", "stocks", "at", "for", "of", "and", "the",
    "a", "an", "to", "in", "on", "order", "trade", "i", "you", "is",
    "am", "pm", "please", "want",
)

private val SYMBOL_TOKEN = Regex("^[A-Za-z]{1,5}(\\.[A-Za-z]{1,2})?$")
private val QTY_TOKEN = Regex("^\\d{1,7}$")
private val WORD_TOKEN = Regex("[A-Za-z0-9]+(?:\\.[A-Za-z0-9]+)?")

private const val QTY_WINDOW_TOKENS: Int = 2

/**
 * Natural-language order parser. The model answers intent (noul) plus side
 * (choice over buy, sell, unknown) in one call; symbol and quantity come
 * from documented code heuristics over the same text. Thresholds live here
 * in code. A missing or malformed answer falls back per field to
 * no-intent and unknown side; a list-level failure throws and the caller
 * keeps code-only extraction. Nothing here executes a trade.
 */
class OrderParseProvider(private val backend: DecisionBackend) {
    fun parse(text: String): ParsedOrder {
        val answers = try {
            backend.score(stateJson(text), questionsFor())
        } catch (_: Exception) {
            return codeOnly(text)
        }
        val intent = answers.path("intent").path("noul").asDouble(Double.NaN)
        val side = answers.path("side").path("choice").asText().takeIf { it in SIDE_CHOICES } ?: "unknown"
        if (!intent.isFinite()) return codeOnly(text)
        val slots = extractSlots(text)
        return ParsedOrder(
            intent = intent >= PARSE_THRESHOLD,
            side = side,
            symbol = slots.first,
            qty = slots.second,
            method = "model",
        )
    }

    private fun stateJson(text: String): String = jsonBody(mapOf("request" to text))

    private fun questionsFor(): Map<String, Any> = mapOf(
        "intent" to mapOf(
            "type" to "noul",
            "instructions" to "Is `request` a stock trade order?",
        ),
        "side" to mapOf(
            "type" to "choice",
            "instructions" to "Which trade side does `request` ask for?",
            "criteria" to SIDE_CHOICES,
        ),
    )
}

/** Code-only extraction for fallback: no intent, unknown side, heuristic slots. */
fun codeOnly(text: String): ParsedOrder {
    val slots = extractSlots(text)
    return ParsedOrder(intent = false, side = "unknown", symbol = slots.first, qty = slots.second, method = "code")
}

/**
 * Heuristic slot fill. Symbol is the short all-caps token nearest a
 * quantity that is not an order word — tickers are conventionally written
 * in caps, which keeps plain English out. One- and two-letter tokens only
 * qualify within two tokens of a quantity, so chatter like "what time is
 * it" or "What is IT worth in 2026?" yields nothing while "buy 10 IT"
 * still resolves. Without any quantity the first qualifying token wins.
 * Quantity is the first standalone integer outside decimals. The trade form
 * confirms both before anything executes.
 */
fun extractSlots(text: String): Pair<String?, Int?> {
    val words = WORD_TOKEN.findAll(text).map { it.value }.toList()
    val qtyIndices = words.indices.filter { QTY_TOKEN.matches(words[it]) }
    val qty = qtyIndices.firstOrNull()?.let { words[it].toInt() }?.takeIf { it > 0 }
    val symbol = words.indices.filter { isSymbolAt(words, qtyIndices, it) }
        .minByOrNull { candidate -> qtyIndices.minOfOrNull { kotlin.math.abs(it - candidate) } ?: Int.MAX_VALUE }
        ?.let { words[it].uppercase() }
    return symbol to qty
}

private fun isSymbolAt(words: List<String>, qtyIndices: List<Int>, index: Int): Boolean {
    val token = words[index]
    if (!isSymbolWord(token)) return false
    if ('.' !in token && token.length > 2) return true
    return qtyIndices.any { kotlin.math.abs(it - index) <= QTY_WINDOW_TOKENS }
}

private fun isSymbolWord(token: String): Boolean {
    if (!SYMBOL_TOKEN.matches(token)) return false
    if (!token.all { !it.isLetter() || it.isUpperCase() }) return false
    return token.lowercase() !in STOP_WORDS
}
