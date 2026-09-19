package rssapi.frontpage

import com.fasterxml.jackson.databind.JsonNode
import rssapi.ai.JevBackend
import rssapi.ai.jsonBody
import rssapi.persist.ArticleEntity

const val JEV_BATCH_MAX: Int = 20
const val JEV_TOP_WORDS: Int = 10
const val JEV_MAX_QUESTIONS: Int = 64

/** One front-page candidate packaged for a Jev batch call, with its signal input for fallback. */
data class JevCandidate(
    val id: String,
    val title: String,
    val feed: String,
    val hot: Double,
    val input: SignalInput,
)

private val INTEREST_LEVELS = listOf("Not interesting to this reader", "Worth a skim", "Must read")

private val TOPIC_CHOICES = listOf("news", "tech", "sports", "culture", "science", "business", "other")

/**
 * Phase 2 batch scorer. Single-shot [score] stays on signals (Jev cannot
 * rank one article in isolation); per-serve ranking goes through
 * [scoreBatch], which asks one narrow judgment per question over shared
 * state and maps answers back to 0..1 scores. Thresholds and caps live
 * here in code. A question that comes back missing or malformed falls back
 * per-article to signals; a list-level failure throws and the caller falls
 * back for the whole batch. Never logs titles or affinity contents.
 */
class JevScoreProvider(
    private val backend: JevBackend,
    private val signals: SignalScoreProvider = SignalScoreProvider(),
) : ScoreProvider {
    override fun score(input: SignalInput): SignalScores = signals.score(input)

    fun scoreBatch(
        topWords: List<String>,
        affinity: Map<String, Float>,
        candidates: List<JevCandidate>,
    ): Map<String, SignalScores> {
        val batch = candidates.take(minOf(JEV_BATCH_MAX, JEV_MAX_QUESTIONS / 3))
        if (batch.isEmpty()) return emptyMap()
        val answers = backend.score(stateJson(topWords, affinity, batch), questionsFor(batch))
        return batch.associate { it.id to scoresFor(it, answers) }
    }

    private fun scoresFor(candidate: JevCandidate, answers: JsonNode): SignalScores {
        val fallback = signals.score(candidate.input)
        val worthy = answers.path(candidate.id + "_worthy").path("noul").asDouble(Double.NaN)
        val interest = answers.path(candidate.id + "_interest").path("score").asDouble(Double.NaN)
        if (!worthy.isFinite() || !interest.isFinite()) return fallback
        val topic = answers.path(candidate.id + "_topic").path("choice").asText().takeIf { it in TOPIC_CHOICES }
        return SignalScores(
            worthy = worthy.coerceIn(0.0, 1.0),
            interest = (interest / 2.0).coerceIn(0.0, 1.0),
            popularityOutlook = fallback.popularityOutlook,
            readability = fallback.readability,
            topic = topic,
        )
    }

    private fun stateJson(
        topWords: List<String>,
        affinity: Map<String, Float>,
        candidates: List<JevCandidate>,
    ): String = jsonBody(
        mapOf(
            "reader" to mapOf("topWords" to topWords, "affinity" to affinity),
            "candidates" to candidates.map {
                mapOf("id" to it.id, "title" to it.title, "feed" to it.feed, "hot" to it.hot)
            },
        ),
    )

    private fun questionsFor(candidates: List<JevCandidate>): Map<String, Any> {
        val out = LinkedHashMap<String, Any>(candidates.size * 3)
        candidates.forEachIndexed { index, candidate ->
            out[candidate.id + "_worthy"] = mapOf(
                "type" to "noul",
                "instructions" to "Is `candidates[$index].title` front-page worthy for this reader?",
            )
            out[candidate.id + "_interest"] = mapOf(
                "type" to "score",
                "instructions" to "How interesting is `candidates[$index].title` to this reader?",
                "criteria" to INTEREST_LEVELS,
            )
            out[candidate.id + "_topic"] = mapOf(
                "type" to "choice",
                "instructions" to "Which topic best fits `candidates[$index].title`?",
                "criteria" to TOPIC_CHOICES,
            )
        }
        return out
    }
}

/** Reader-affinity total for one article: feed plus domain plus author components, floored at zero. */
internal fun affinityOf(article: ArticleEntity, affinityMap: Map<String, Float>): Double {
    var total = (affinityMap["aff:feed:${article.feedId}"] ?: 0f).toDouble()
    article.domain?.let { total += (affinityMap["aff:domain:$it"] ?: 0f).toDouble() }
    article.author?.let { total += (affinityMap["aff:author:${it.lowercase()}"] ?: 0f).toDouble() }
    return maxOf(0.0, total)
}

/** Raw signal inputs for one article, shared by the signal path and Jev fallback. */
internal fun signalInputOf(article: ArticleEntity, affinityMap: Map<String, Float>): SignalInput = SignalInput(
    hot = article.hot.toDouble(),
    popularity = article.popularity.toDouble(),
    engagement = article.engagement.toDouble(),
    affinity = affinityOf(article, affinityMap),
    wordCount = wordCountOf(article),
)

/** Batch candidate for one article, carrying its signal input for per-article fallback. */
internal fun jevCandidateOf(article: ArticleEntity, input: SignalInput): JevCandidate = JevCandidate(
    id = article.id,
    title = article.title,
    feed = article.feedId.toString(),
    hot = article.hot.toDouble(),
    input = input,
)

/** Top affinity keys by value, giving Jev a compact picture of reader taste. */
internal fun topWordsOf(affinityMap: Map<String, Float>): List<String> =
    affinityMap.entries.sortedByDescending { it.value }.take(JEV_TOP_WORDS).map { it.key }
