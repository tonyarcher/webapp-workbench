package radioapi.safety

import com.fasterxml.jackson.databind.JsonNode
import radioapi.ai.DecisionBackend
import radioapi.ai.jsonBody

const val SAFETY_BATCH_MAX: Int = 20
const val SAFETY_MAX_QUESTIONS: Int = 64

/** One catalog track packaged for a decision-model batch call. */
data class SafetyCandidate(val id: String, val artist: String, val title: String, val explicit: Boolean)

/** Safety scores, each 0..1. `safe` near 1 means daytime-safe. */
data class SafetyScores(val safe: Double, val fit: Double)

private val FIT_LEVELS = listOf("No fit for this station", "Background fit", "Strong fit")

/**
 * Decision-model safety annotator. [scoreBatch] asks two narrow judgments per
 * track over shared station state and maps answers back to 0..1 scores.
 * Thresholds and caps live here in code. A track with a missing or malformed
 * answer falls back per track to the `explicit` column; a list-level failure
 * throws and the caller keeps the deterministic catalog. Never logs artist or
 * title contents.
 */
class TrackSafetyProvider(private val backend: DecisionBackend) {
    fun scoreBatch(station: String, candidates: List<SafetyCandidate>): Map<String, SafetyScores> {
        val batch = candidates.take(minOf(SAFETY_BATCH_MAX, SAFETY_MAX_QUESTIONS / 2))
        if (batch.isEmpty()) return emptyMap()
        val answers = backend.score(stateJson(station, batch), questionsFor(batch))
        return batch.mapNotNull { candidate ->
            scoresFor(candidate, answers)?.let { candidate.id to it }
        }.toMap()
    }

    private fun scoresFor(candidate: SafetyCandidate, answers: JsonNode): SafetyScores? {
        val explicit = answers.path(candidate.id + "_explicit").path("noul").asDouble(Double.NaN)
        val fit = answers.path(candidate.id + "_fit").path("score").asDouble(Double.NaN)
        if (!explicit.isFinite() || !fit.isFinite()) return null
        return SafetyScores(
            safe = (1.0 - explicit).coerceIn(0.0, 1.0),
            fit = (fit / 2.0).coerceIn(0.0, 1.0),
        )
    }

    private fun stateJson(station: String, candidates: List<SafetyCandidate>): String = jsonBody(
        mapOf(
            "station" to station,
            "candidates" to candidates.map {
                mapOf("id" to it.id, "artist" to it.artist, "title" to it.title, "explicit" to it.explicit)
            },
        ),
    )

    private fun questionsFor(candidates: List<SafetyCandidate>): Map<String, Any> {
        val out = LinkedHashMap<String, Any>(candidates.size * 2)
        candidates.forEachIndexed { index, candidate ->
            out[candidate.id + "_explicit"] = mapOf(
                "type" to "noul",
                "instructions" to "Is `candidates[$index]` explicit or unsafe for daytime radio?",
            )
            out[candidate.id + "_fit"] = mapOf(
                "type" to "score",
                "instructions" to "How well does `candidates[$index]` fit this station?",
                "criteria" to FIT_LEVELS,
            )
        }
        return out
    }
}

/** Per-track fallback from the catalog explicit flag when the model answer is missing. */
fun safetyFallback(explicit: Boolean): SafetyScores = SafetyScores(safe = if (explicit) 0.0 else 1.0, fit = 0.5)
