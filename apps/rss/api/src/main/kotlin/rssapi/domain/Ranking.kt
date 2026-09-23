package rssapi.domain

import java.net.URI

/** Popularity weighting: one point per extra feed, comments capped. */
private const val BASE_POPULARITY = 1
private const val PER_EXTRA_FEED = 3
private const val COMMENT_CAP = 50

/** Affinity boost saturates: log10 scaled, hard-capped at [AFFINITY_MAX]. */
private const val AFFINITY_MAX = 4.0
private const val AFFINITY_SCALE = 1.5

private const val MS_PER_SECOND = 1000.0

private val TRACKING_PARAMS = setOf(
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
    "fbclid", "gclid", "yclid", "igshid", "ref", "ref_src", "mc_cid", "mc_eid",
)

fun normalizeLink(url: String): String = try {
    val u = URI(url).toURL()
    val host = u.host.lowercase().removePrefix("www.")
    val path = u.path.replace(Regex("/+$"), "")
    val search = filteredSearch(u.query)
    "$host$path$search"
} catch (_: Exception) {
    url
}

private fun filteredSearch(query: String?): String {
    if (query.isNullOrEmpty()) return ""
    val kept = query.split("&").filter { pair ->
        pair.substringBefore("=").lowercase() !in TRACKING_PARAMS
    }
    return if (kept.isEmpty()) "" else "?" + kept.joinToString("&")
}

fun popularityScore(syndicationCount: Int, comments: Int): Double {
    val extra = maxOf(0, syndicationCount - 1)
    val capped = minOf(maxOf(0, comments), COMMENT_CAP)
    return (BASE_POPULARITY + PER_EXTRA_FEED * extra + capped).toDouble()
}

fun affinityBoostScore(affinity: Double): Double =
    minOf(AFFINITY_MAX, kotlin.math.log10(1 + maxOf(0.0, affinity)) * AFFINITY_SCALE)

/** Velocity counts only within this window; a story older than this gets no bonus. */
private const val VELOCITY_WINDOW_MS = 24 * 3_600_000.0

/** Extra feeds sharing a story within the window, scaled by recency, capped. */
private const val VELOCITY_MAX = 3.0

fun velocityBonus(extraFeedCount: Int, ageMs: Long?): Double {
    if (ageMs == null || ageMs < 0 || ageMs > VELOCITY_WINDOW_MS) return 0.0
    val recency = 1 - ageMs / VELOCITY_WINDOW_MS
    return minOf(VELOCITY_MAX, extraFeedCount * recency)
}

private const val REDDIT_EPOCH = 1_134_028_003.0
private const val HOT_GRAVITY = 90_000.0

fun hotScore(popularity: Double, engagement: Double, publishedMs: Long): Double {
    val p = maxOf(popularity + maxOf(0.0, engagement), 1.0)
    return kotlin.math.log10(p) + (publishedMs / MS_PER_SECOND - REDDIT_EPOCH) / HOT_GRAVITY
}
