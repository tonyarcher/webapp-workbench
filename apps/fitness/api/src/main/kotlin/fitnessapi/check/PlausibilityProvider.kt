package fitnessapi.check

import com.fasterxml.jackson.databind.JsonNode
import fitnessapi.ai.DecisionBackend
import fitnessapi.ai.jsonBody

const val CHECK_BATCH_MAX: Int = 20
const val CHECK_MAX_PER_CALL: Int = 20
const val FLAG_REVIEW_AT: Double = 0.5
const val FLAG_PLAUSIBLE_BELOW: Double = 0.35

/** One submitted sample plus the recent history the decision needs. */
data class CheckCandidate(
    val id: String,
    val metric: String,
    val valueSi: Double,
    val latestValueSi: Double?,
    val avgSi: Double?,
    val historyN: Long,
)

/** Per-sample model scores, each 0..1. */
data class PlausibilityScores(val plausible: Double, val review: Double)

/** One checked sample for the response. */
data class CheckVerdict(val id: String, val valid: Boolean, val flagged: Boolean, val method: String)

/**
 * Import plausibility check. Code validates shape and metric first; this
 * provider asks two narrow judgments per sample over shared history state
 * and maps answers back to 0..1 scores. Thresholds and caps live here in
 * code. A sample with a missing or malformed answer falls back per sample
 * to unflagged; a list-level failure throws and the caller keeps the code
 * verdicts. Never logs sample payloads.
 */
class PlausibilityProvider(private val backend: DecisionBackend) {
    fun scoreBatch(candidates: List<CheckCandidate>): Map<String, PlausibilityScores> {
        val batch = candidates.take(CHECK_BATCH_MAX)
        if (batch.isEmpty()) return emptyMap()
        val answers = backend.score(stateJson(batch), questionsFor(batch))
        return batch.mapNotNull { candidate ->
            scoresFor(candidate, answers)?.let { candidate.id to it }
        }.toMap()
    }

    private fun scoresFor(candidate: CheckCandidate, answers: JsonNode): PlausibilityScores? {
        val plausible = answers.path(candidate.id + "_plausible").path("score").asDouble(Double.NaN)
        val review = answers.path(candidate.id + "_review").path("noul").asDouble(Double.NaN)
        if (!plausible.isFinite() || !review.isFinite()) return null
        return PlausibilityScores(
            plausible = (plausible / 2.0).coerceIn(0.0, 1.0),
            review = review.coerceIn(0.0, 1.0),
        )
    }

    private fun stateJson(candidates: List<CheckCandidate>): String = jsonBody(
        mapOf(
            "candidates" to candidates.map {
                mapOf(
                    "id" to it.id,
                    "metric" to it.metric,
                    "value" to it.valueSi,
                    "latest" to it.latestValueSi,
                    "average" to it.avgSi,
                    "history" to it.historyN,
                )
            },
        ),
    )

    private fun questionsFor(candidates: List<CheckCandidate>): Map<String, Any> {
        val out = LinkedHashMap<String, Any>(candidates.size * 2)
        candidates.forEachIndexed { index, candidate ->
            out[candidate.id + "_plausible"] = mapOf(
                "type" to "score",
                "instructions" to "How plausible is `candidates[$index].value` for this metric given its history?",
                "criteria" to PLAUSIBLE_LEVELS,
            )
            out[candidate.id + "_review"] = mapOf(
                "type" to "noul",
                "instructions" to "Does `candidates[$index].value` need human review before import?",
            )
        }
        return out
    }
}

private val PLAUSIBLE_LEVELS =
    listOf("Implausible, likely a parse or unit error", "Unusual but possible", "Fits history")

/** Code verdict for one candidate from model scores; missing scores stay unflagged. */
fun verdictFor(id: String, scores: PlausibilityScores?): CheckVerdict {
    if (scores == null) return CheckVerdict(id, valid = true, flagged = false, method = "code")
    val flagged = scores.review >= FLAG_REVIEW_AT || scores.plausible <= FLAG_PLAUSIBLE_BELOW
    return CheckVerdict(id, valid = true, flagged = flagged, method = "model")
}
