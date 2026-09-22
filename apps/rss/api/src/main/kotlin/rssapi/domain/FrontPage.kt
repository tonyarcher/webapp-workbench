package rssapi.domain

/**
 * Phase 1 front-page signals. Pure and deterministic: the same inputs always
 * produce the same outputs, so scores are cacheable in `article_scores` and
 * Phase 2 (Jev) can replace the blend without changing callers.
 *
 * Every function returns a value clamped to 0..1 (non-finite inputs map to an
 * endpoint, never NaN). `hot` is an absolute Reddit-style score centered near
 * [HOT_CENTER], so it is passed through a logistic; popularity/engagement use
 * a saturating `v / (v + scale)` curve; affinity reuses [affinityBoostScore]
 * normalized by its 4.0 cap.
 */
private const val HOT_CENTER = 6_300.0
private const val HOT_SCALE = 10.0
private const val SATURATION_SCALE = 10.0
private const val AFFINITY_CAP = 4.0
private const val SHORT_WORDS = 150
private const val IDEAL_WORDS = 1_200
private const val LONG_TAIL_WORDS = 5_000.0

private fun clamp01(value: Double): Double = if (value.isNaN()) 0.0 else value.coerceIn(0.0, 1.0)

private fun saturatingNorm(value: Double): Double = when {
    value.isNaN() -> 0.0
    value <= 0.0 -> 0.0
    !value.isFinite() -> 1.0
    else -> value / (value + SATURATION_SCALE)
}

private fun affinityNorm(affinity: Double): Double = affinityBoostScore(affinity) / AFFINITY_CAP

private fun hotNorm(hot: Double): Double = 1.0 / (1.0 + kotlin.math.exp(-(hot - HOT_CENTER) / HOT_SCALE))

/** Editorial blend: recency-weighted heat plus broad appeal. */
fun signalWorthy(hot: Double, popularity: Double, engagement: Double, affinity: Double): Double =
    clamp01(
        0.40 * hotNorm(hot) +
            0.25 * saturatingNorm(popularity) +
            0.15 * saturatingNorm(engagement) +
            0.20 * affinityNorm(affinity),
    )

/** Personal blend: same inputs as [signalWorthy] but weighted toward reader affinity. */
fun signalInterest(hot: Double, popularity: Double, engagement: Double, affinity: Double): Double =
    clamp01(
        0.20 * hotNorm(hot) +
            0.20 * saturatingNorm(popularity) +
            0.15 * saturatingNorm(engagement) +
            0.45 * affinityNorm(affinity),
    )

/** Outlook blend: syndication/comment momentum with a small affinity tilt. */
fun signalPopularityOutlook(hot: Double, popularity: Double, engagement: Double, affinity: Double): Double =
    clamp01(
        0.15 * hotNorm(hot) +
            0.50 * saturatingNorm(popularity) +
            0.25 * saturatingNorm(engagement) +
            0.10 * affinityNorm(affinity),
    )

/**
 * Readability peaks for feature-length reads ([SHORT_WORDS]..[IDEAL_WORDS]
 * words), ramps up from zero for stubs, and decays past the ideal length.
 */
fun signalReadability(wordCount: Int): Double = clamp01(
    when {
        wordCount <= 0 -> 0.0
        wordCount < SHORT_WORDS -> 0.6 * wordCount / SHORT_WORDS
        wordCount <= IDEAL_WORDS -> 0.6 + 0.4 * (wordCount - SHORT_WORDS) / (IDEAL_WORDS - SHORT_WORDS)
        else -> 1.0 - (wordCount - IDEAL_WORDS) / LONG_TAIL_WORDS
    },
)
