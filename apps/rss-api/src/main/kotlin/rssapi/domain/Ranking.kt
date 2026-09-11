package rssapi.domain

import java.net.URL

private val TRACKING_PARAMS = setOf(
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
    "fbclid", "gclid", "yclid", "igshid", "ref", "ref_src", "mc_cid", "mc_eid",
)

fun normalizeLink(url: String): String {
    return try {
        val u = URL(url)
        val host = u.host.lowercase().removePrefix("www.")
        val path = u.path.replace(Regex("/+$"), "")
        val search = filteredSearch(u.query)
        "$host$path$search"
    } catch (_: Exception) {
        url
    }
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
    val capped = minOf(maxOf(0, comments), 50)
    return (1 + 3 * extra + capped).toDouble()
}

fun affinityBoostScore(affinity: Double): Double =
    minOf(4.0, kotlin.math.log10(1 + maxOf(0.0, affinity)) * 1.5)

private const val VELOCITY_WINDOW_MS = 24 * 3_600_000.0

fun velocityBonus(extraFeedCount: Int, ageMs: Long?): Double {
    if (ageMs == null || ageMs < 0 || ageMs > VELOCITY_WINDOW_MS) return 0.0
    val recency = 1 - ageMs / VELOCITY_WINDOW_MS
    return minOf(3.0, extraFeedCount * recency)
}

private const val REDDIT_EPOCH = 1_134_028_003.0
private const val HOT_GRAVITY = 90_000.0

fun hotScore(popularity: Double, engagement: Double, publishedMs: Long): Double {
    val p = maxOf(popularity + maxOf(0.0, engagement), 1.0)
    return kotlin.math.log10(p) + (publishedMs / 1000.0 - REDDIT_EPOCH) / HOT_GRAVITY
}
