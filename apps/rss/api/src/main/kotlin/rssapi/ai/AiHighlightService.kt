package rssapi.ai

import com.fasterxml.jackson.databind.JsonNode
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import rssapi.log.log
import rssapi.web.ApiException
import java.util.UUID

data class HighlightExcerpt(val index: Int, val text: String, val score: Double)

/**
 * Row-level assistance selected by the decision model, never written by it:
 * the excerpt strings are verbatim slices of the article and are shown with
 * their source row. [interesting] and [spam] are typed scores the client
 * uses to explain the ranking; they are not prose.
 */
data class HighlightResult(
    val available: Boolean,
    val excerpts: List<HighlightExcerpt> = emptyList(),
    val interesting: Double? = null,
    val spam: Double? = null,
)

private const val MAX_CANDIDATES = 8
private const val MAX_EXCERPTS = 3
private const val MIN_CHARS = 40
private const val MAX_CHARS = 320
private const val SELECT_AT = 0.60

/**
 * Extractive highlights plus the typed why-this-row signals. One narrow
 * decision per candidate excerpt; no open-ended generation, no prompt or
 * payload logging. When the decision model is missing or fails, the whole
 * feature reports unavailable instead of inventing text.
 */
@Service
class AiHighlightService(
    private val backend: DecisionBackend,
    private val quotas: AiQuotaService,
    private val config: AiConfig,
) {
    fun highlights(userId: UUID, title: String, contentHtml: String?, readMinutes: Int): HighlightResult {
        val candidates = candidatesOf(contentHtml)
        if (candidates.isEmpty()) return HighlightResult(true)
        if (config.decisionApiKey.isBlank() || !backend.probe()) return HighlightResult(false)
        quotas.consume(userId, config.hourlyLimit, config.dailyLimit)
        val answers = scoreOrUnavailable(
            stateFor(title, readMinutes, candidates),
            candidates,
            contentHtml?.length ?: 0,
        ) ?: return HighlightResult(false)
        return resultFor(candidates, answers)
    }

    private fun scoreOrUnavailable(state: String, candidates: List<HighlightCandidate>, inputChars: Int): JsonNode? {
        val started = System.currentTimeMillis()
        return try {
            backend.score(state, questionsFor(candidates))
        } catch (_: AiException) {
            log(
                "rss-api",
                "info",
                "highlights failed",
                mapOf(
                    "input_chars" to inputChars.toString(),
                    "duration_ms" to (System.currentTimeMillis() - started).toString(),
                ),
            )
            null
        }
    }

    private fun stateFor(title: String, readMinutes: Int, candidates: List<HighlightCandidate>): String = jsonBody(
        mapOf(
            "title" to title,
            "readMinutes" to readMinutes,
            "candidates" to candidates.map { mapOf("index" to it.index, "text" to it.text) },
        ),
    )

    private fun resultFor(candidates: List<HighlightCandidate>, answers: JsonNode): HighlightResult {
        val interesting = answers.path("interesting").path("score").asDouble(Double.NaN)
        val spam = answers.path("spam").path("noul").asDouble(Double.NaN)
        return HighlightResult(
            available = true,
            excerpts = selectExcerpts(candidates, answers),
            interesting = if (interesting.isFinite()) interesting.coerceIn(0.0, 2.0) / 2.0 else null,
            spam = if (spam.isFinite()) spam.coerceIn(0.0, 1.0) else null,
        )
    }

    private fun questionsFor(candidates: List<HighlightCandidate>): Map<String, Any> {
        val questions = LinkedHashMap<String, Any>(candidates.size + 2)
        candidates.forEachIndexed { i, _ ->
            questions["excerpt_$i"] = mapOf(
                "type" to "noul",
                "instructions" to "Is candidates[$i].text a key line worth surfacing as an extractive highlight?",
            )
        }
        questions["interesting"] = mapOf(
            "type" to "score",
            "instructions" to "How interesting is this article to this reader?",
            "criteria" to listOf("Not interesting to this reader", "Worth a skim", "Must read"),
        )
        questions["spam"] = mapOf(
            "type" to "noul",
            "instructions" to "Is this article spam, an ad, or boilerplate?",
        )
        return questions
    }

    private fun selectExcerpts(candidates: List<HighlightCandidate>, answers: JsonNode): List<HighlightExcerpt> =
        candidates.mapIndexedNotNull { i, candidate ->
            val noul = answers.path("excerpt_$i").path("noul").asDouble(Double.NaN)
            if (noul.isFinite() && noul >= SELECT_AT) HighlightExcerpt(candidate.index, candidate.text, noul) else null
        }
            .sortedByDescending { it.score }
            .take(MAX_EXCERPTS)
            .sortedBy { it.index }

    /**
     * Sentence-sized candidates from the article body: strip markup, split on
     * sentence ends and paragraph breaks, drop noise, dedupe, cap. Indices are
     * stable for one article and shared with the question ids.
     */
    internal fun candidatesOf(contentHtml: String?): List<HighlightCandidate> {
        if (contentHtml.isNullOrBlank()) return emptyList()
        val plain = unescape(contentHtml.replace(Regex("<[^>]+>"), " "))
        val seen = HashSet<String>()
        return plain.split(Regex("\\n+|(?<=[.!?])\\s+"))
            .asSequence()
            .map { it.replace(Regex("\\s+"), " ").trim() }
            .filter { it.length in MIN_CHARS..MAX_CHARS && seen.add(it.lowercase()) }
            .take(MAX_CANDIDATES)
            .mapIndexed { i, text -> HighlightCandidate(i, text) }
            .toList()
    }

    private fun unescape(s: String): String = s
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
}

internal data class HighlightCandidate(val index: Int, val text: String)
