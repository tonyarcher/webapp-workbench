package rssapi.domain

import java.time.Instant
import java.util.UUID

/**
 * Pure edition ranking (Phase A). Deterministic: same inputs always give the
 * same clusters and scores, so builds are reproducible and unit-testable.
 * No Spring, no persistence, no logging here.
 */

/** Rank blend; each weight is coerced to 0..1 then normalized by the sum. */
data class RankWeights(
    val generalInterest: Double,
    val personalInterest: Double,
    val newness: Double,
    val popularity: Double,
)

/** One article projected into edition ranking. `storyKey` is the syndication key (`normLink`). */
data class EditionArticle(
    val id: String,
    val feedId: UUID,
    val title: String,
    val excerpt: String,
    val publishedAt: Instant,
    val hot: Double,
    val popularity: Double,
    val engagement: Double,
    val domain: String?,
    val author: String?,
    val storyKey: String?,
)

/** Articles sharing one story. Key `solo:<id>` marks a singleton. */
data class Cluster(val key: String, val articles: List<EditionArticle>)

private val TAG_CLEAN = Regex("<[^>]*>")
private val WS_CLEAN = Regex("\\s+")

/**
 * Groups articles by non-null `storyKey`. Null-key articles always stay solo:
 * without a syndication key there is no reliable signal they cover the same
 * story, and feed+day merging would conflate distinct stories, so each keeps
 * its own `solo:<id>` cluster. Members run newest-first; clusters sort by key.
 */
fun clusterByStory(articles: List<EditionArticle>): List<Cluster> {
    val out = mutableListOf<Cluster>()
    for ((story, members) in articles.groupBy { it.storyKey }) {
        if (story == null) {
            for (solo in members) out.add(Cluster("solo:${solo.id}", listOf(solo)))
        } else {
            val newest = compareByDescending<EditionArticle> { it.publishedAt }.thenBy { it.id }
            out.add(Cluster(story, members.sortedWith(newest)))
        }
    }
    return out.sortedBy { it.key }
}

/** Affinity lookup keys for one article, shared with the front-page scorer. */
fun affinityKeys(feedId: UUID, domain: String?, author: String?): List<String> = listOfNotNull(
    "aff:feed:$feedId",
    domain?.let { "aff:domain:$it" },
    author?.let { "aff:author:${it.lowercase()}" },
)

/** Reader-affinity total for one article: feed plus domain plus author, floored at zero. */
fun affinitySum(
    feedId: UUID,
    domain: String?,
    author: String?,
    affinity: Map<String, Float>,
): Double {
    var total = (affinity["aff:feed:$feedId"] ?: 0f).toDouble()
    domain?.let { total += (affinity["aff:domain:$it"] ?: 0f).toDouble() }
    author?.let { total += (affinity["aff:author:${it.lowercase()}"] ?: 0f).toDouble() }
    return maxOf(0.0, total)
}

/** Saturating `v / (v + 10)` curve mirroring the front-page signal blends. */
private fun saturating(value: Double): Double = when {
    value.isNaN() -> 0.0
    value <= 0.0 -> 0.0
    !value.isFinite() -> 1.0
    else -> value / (value + 10.0)
}

/** Linear recency decay over the edition window: 1 at [now], 0 past the window edge. */
internal fun newnessOf(publishedAt: Instant, now: Instant, windowHours: Long): Double {
    if (windowHours <= 0) return 0.0
    val ageMs = now.toEpochMilli() - publishedAt.toEpochMilli()
    if (ageMs <= 0) return 1.0
    return maxOf(0.0, 1.0 - ageMs.toDouble() / (windowHours * 3_600_000.0))
}

/**
 * Weighted blend over cluster means: signal worthy/interest (via shared
 * front-page blends), recency decay, and saturated popularity momentum.
 * Empty clusters and all-zero weights rank 0; ties break by cluster key in [sortClusters].
 */
fun compositeRank(
    cluster: Cluster,
    affinity: Map<String, Float>,
    weights: RankWeights,
    now: Instant = Instant.now(),
    windowHours: Long = 24,
): Double {
    if (cluster.articles.isEmpty()) return 0.0
    val general = weights.generalInterest.coerceIn(0.0, 1.0)
    val personal = weights.personalInterest.coerceIn(0.0, 1.0)
    val fresh = weights.newness.coerceIn(0.0, 1.0)
    val popular = weights.popularity.coerceIn(0.0, 1.0)
    val total = general + personal + fresh + popular
    if (total <= 0.0) return 0.0
    val generalMean = cluster.articles.map {
        signalWorthy(it.hot, it.popularity, it.engagement, affinityOf(it, affinity))
    }
    val personalMean = cluster.articles.map {
        signalInterest(it.hot, it.popularity, it.engagement, affinityOf(it, affinity))
    }
    val freshMean = cluster.articles.map { newnessOf(it.publishedAt, now, windowHours) }
    val popularMean = cluster.articles.map { (saturating(it.popularity) + saturating(it.engagement)) / 2.0 }
    return (general * generalMean.average() + personal * personalMean.average() +
        fresh * freshMean.average() + popular * popularMean.average()) / total
}

private fun affinityOf(article: EditionArticle, affinity: Map<String, Float>): Double =
    affinitySum(article.feedId, article.domain, article.author, affinity)

/** Ranks every cluster and sorts by score descending, key ascending. */
fun sortClusters(
    clusters: List<Cluster>,
    affinity: Map<String, Float>,
    weights: RankWeights,
    now: Instant = Instant.now(),
    windowHours: Long = 24,
): List<Cluster> = clusters.map { it to compositeRank(it, affinity, weights, now, windowHours) }
    .sortedWith(compareByDescending<Pair<Cluster, Double>> { it.second }.thenBy { it.first.key })
    .map { it.first }

/** Most common title; ties break alphabetically. Null when there are no votes. */
fun voteTopic(titles: List<String>): String? = titles.groupingBy { it }.eachCount().entries
    .sortedWith(compareByDescending<Map.Entry<String, Int>> { it.value }.thenBy { it.key })
    .firstOrNull()?.key

/** Strips tags, collapses whitespace, caps length. Null/blank input yields "". */
fun plainExcerpt(html: String?, maxChars: Int): String {
    if (html.isNullOrBlank() || maxChars <= 0) return ""
    return TAG_CLEAN.replace(html, " ").split(WS_CLEAN).filter { it.isNotBlank() }.joinToString(" ").take(maxChars)
}
