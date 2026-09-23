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

/** Blend weights. Each row sums to 1.0 so a signal stays clamped to 0..1. */
private const val WORTHY_HOT = 0.40
private const val WORTHY_POPULARITY = 0.25
private const val WORTHY_ENGAGEMENT = 0.15
private const val WORTHY_AFFINITY = 0.20

private const val INTEREST_HOT = 0.20
private const val INTEREST_POPULARITY = 0.20
private const val INTEREST_ENGAGEMENT = 0.15
private const val INTEREST_AFFINITY = 0.45

private const val OUTLOOK_HOT = 0.15
private const val OUTLOOK_POPULARITY = 0.50
private const val OUTLOOK_ENGAGEMENT = 0.25
private const val OUTLOOK_AFFINITY = 0.10

/** Readability reaches [STUB_FLOOR] at SHORT_WORDS and gains to 1.0 at the ideal. */
private const val STUB_FLOOR = 0.6
private const val IDEAL_GAIN = 0.4

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
fun signalWorthy(hot: Double, popularity: Double, engagement: Double, affinity: Double): Double = clamp01(
    WORTHY_HOT * hotNorm(hot) +
        WORTHY_POPULARITY * saturatingNorm(popularity) +
        WORTHY_ENGAGEMENT * saturatingNorm(engagement) +
        WORTHY_AFFINITY * affinityNorm(affinity),
)

/** Personal blend: same inputs as [signalWorthy] but weighted toward reader affinity. */
fun signalInterest(hot: Double, popularity: Double, engagement: Double, affinity: Double): Double = clamp01(
    INTEREST_HOT * hotNorm(hot) +
        INTEREST_POPULARITY * saturatingNorm(popularity) +
        INTEREST_ENGAGEMENT * saturatingNorm(engagement) +
        INTEREST_AFFINITY * affinityNorm(affinity),
)

/** Outlook blend: syndication/comment momentum with a small affinity tilt. */
fun signalPopularityOutlook(hot: Double, popularity: Double, engagement: Double, affinity: Double): Double = clamp01(
    OUTLOOK_HOT * hotNorm(hot) +
        OUTLOOK_POPULARITY * saturatingNorm(popularity) +
        OUTLOOK_ENGAGEMENT * saturatingNorm(engagement) +
        OUTLOOK_AFFINITY * affinityNorm(affinity),
)

/**
 * Readability peaks for feature-length reads ([SHORT_WORDS]..[IDEAL_WORDS]
 * words), ramps up from zero for stubs, and decays past the ideal length.
 */
fun signalReadability(wordCount: Int): Double = clamp01(
    when {
        wordCount <= 0 -> 0.0
        wordCount < SHORT_WORDS -> STUB_FLOOR * wordCount / SHORT_WORDS
        wordCount <= IDEAL_WORDS -> STUB_FLOOR + IDEAL_GAIN * (wordCount - SHORT_WORDS) / (IDEAL_WORDS - SHORT_WORDS)
        else -> 1.0 - (wordCount - IDEAL_WORDS) / LONG_TAIL_WORDS
    },
)
