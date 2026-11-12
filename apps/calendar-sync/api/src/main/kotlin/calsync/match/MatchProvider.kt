package calsync.match

import calsync.ai.DecisionBackend
import calsync.ai.jsonBody
import com.fasterxml.jackson.databind.JsonNode

const val MATCH_BATCH_MAX: Int = 20
const val MATCH_MAX_PER_SIDE: Int = 20
const val MATCH_THRESHOLD: Double = 0.8

/** One event to match, carrying only what the decision needs. */
data class MatchEvent(val uid: String, val title: String)

/** One suggested merge between a Trakt event and a Netflix event. */
data class MatchSuggestion(val traktUid: String, val netflixUid: String, val score: Double, val method: String)

/** Candidate pair key for a decision-model batch call. */
data class MatchPair(val id: String, val trakt: MatchEvent, val netflix: MatchEvent)

/**
 * Title matcher. Exact normalized-title matches resolve in code. Remaining
 * pairs go through [scoreBatch], which asks one narrow noul per pair over
 * shared state. Thresholds and caps live here in code. A pair with a missing
 * or malformed answer is left unmatched; a list-level failure throws and the
 * caller keeps the exact matches. Never logs titles beyond the request state.
 */
class MatchProvider(private val backend: DecisionBackend) {
    fun suggest(trakt: List<MatchEvent>, netflix: List<MatchEvent>): List<MatchSuggestion> {
        val boundedTrakt = trakt.take(MATCH_MAX_PER_SIDE)
        val boundedNetflix = netflix.take(MATCH_MAX_PER_SIDE)
        val exact = exactMatches(boundedTrakt, boundedNetflix).toMutableList()
        val matchedTrakt = exact.map { it.traktUid }.toSet()
        val matchedNetflix = exact.map { it.netflixUid }.toSet()
        val remaining = remainingPairs(boundedTrakt, boundedNetflix, matchedTrakt, matchedNetflix)
        if (remaining.isEmpty()) return exact
        val scores = try {
            scoreBatch(remaining)
        } catch (_: Exception) {
            return exact
        }
        remaining.forEach { pair ->
            val score = scores[pair.id] ?: return@forEach
            if (score >= MATCH_THRESHOLD) exact.add(MatchSuggestion(pair.trakt.uid, pair.netflix.uid, score, "model"))
        }
        return exact
    }

    fun scoreBatch(pairs: List<MatchPair>): Map<String, Double> {
        val batch = pairs.take(MATCH_BATCH_MAX)
        if (batch.isEmpty()) return emptyMap()
        val answers = backend.score(stateJson(batch), questionsFor(batch))
        return batch.mapNotNull { pair ->
            val value = answers.path(pair.id).path("noul").asDouble(Double.NaN)
            if (!value.isFinite()) null else pair.id to value.coerceIn(0.0, 1.0)
        }.toMap()
    }

    private fun stateJson(pairs: List<MatchPair>): String = jsonBody(
        mapOf(
            "pairs" to pairs.map {
                mapOf("id" to it.id, "trakt" to it.trakt.title, "netflix" to it.netflix.title)
            },
        ),
    )

    private fun questionsFor(pairs: List<MatchPair>): Map<String, Any> {
        val out = LinkedHashMap<String, Any>(pairs.size)
        pairs.forEachIndexed { index, pair ->
            out[pair.id] = mapOf(
                "type" to "noul",
                "instructions" to "Do `pairs[$index].trakt` and `pairs[$index].netflix` name the same show or movie?",
            )
        }
        return out
    }
}

/** Lowercase alphanumeric title key; empty titles never match. */
fun normalizedTitle(title: String): String = title.lowercase().filter { it.isLetterOrDigit() }

/** Unmatched cross-product pairs, capped for one decision-model batch. */
fun remainingPairs(
    trakt: List<MatchEvent>,
    netflix: List<MatchEvent>,
    matchedTrakt: Set<String>,
    matchedNetflix: Set<String>,
): List<MatchPair> {
    val openTrakt = trakt.filter { it.uid !in matchedTrakt }
    val openNetflix = netflix.filter { it.uid !in matchedNetflix }
    if (openTrakt.isEmpty() || openNetflix.isEmpty()) return emptyList()
    val perLeft = maxOf(1, MATCH_BATCH_MAX / openTrakt.size)
    val out = ArrayList<MatchPair>(MATCH_BATCH_MAX)
    for (left in openTrakt) {
        var taken = 0
        for (right in openNetflix) {
            if (out.size >= MATCH_BATCH_MAX) return out
            if (taken >= perLeft) break
            out.add(MatchPair("${left.uid}::${right.uid}", left, right))
            taken++
        }
    }
    return out
}

/** Exact matches on normalized titles, one suggestion per Trakt event at most. */
fun exactMatches(trakt: List<MatchEvent>, netflix: List<MatchEvent>): List<MatchSuggestion> {
    val byTitle = netflix.groupBy { normalizedTitle(it.title) }.filterKeys { it.isNotEmpty() }
    return trakt.mapNotNull { event ->
        val key = normalizedTitle(event.title)
        if (key.isEmpty()) return@mapNotNull null
        val hit = byTitle[key]?.firstOrNull() ?: return@mapNotNull null
        MatchSuggestion(event.uid, hit.uid, 1.0, "exact")
    }
}
