package radioapi.domain

/** Tuning knobs are 0..100 sliders; this turns one into a 0..1 blend factor. */
private const val PERCENT_SCALE = 100.0

private const val SECONDS_PER_MINUTE = 60.0
private const val MS_PER_MINUTE = 60_000.0

/** Bucket share at the low and high end of the hit-gravity slider. */
private const val POWER_AT_MIN_GRAVITY = 0.15
private const val POWER_AT_MAX_GRAVITY = 0.45
private const val CURRENT_AT_MIN_GRAVITY = 0.25
private const val CURRENT_AT_MAX_GRAVITY = 0.45
private const val RECURRENT_AT_MIN_GRAVITY = 0.50
private const val RECURRENT_AT_MAX_GRAVITY = 0.10

/** Separation windows at the low and high end of the separation slider. */
private const val ARTIST_MIN_MS = 8.0
private const val ARTIST_MAX_MS = 45.0
private const val POWER_TITLE_MIN_MINUTES = 40.0
private const val POWER_TITLE_MAX_MINUTES = 100.0
private const val CURRENT_TITLE_MIN_MINUTES = 2.0
private const val CURRENT_TITLE_MAX_MINUTES = 5.0
private const val RECURRENT_TITLE_MIN_MINUTES = 6.0
private const val RECURRENT_TITLE_MAX_MINUTES = 14.0
private const val GOLD_TITLE_MIN_MINUTES = 8.0
private const val GOLD_TITLE_MAX_MINUTES = 24.0

data class BucketMix(val power: Double, val current: Double, val recurrent: Double)

data class SeparationWindows(val artistMs: Double, val titleMs: Map<String, Double>)

data class OrbitPolicy(val minMs: Double, val forceMs: Double)

fun lerp(start: Double, end: Double, amount: Double): Double = start + (end - start) * amount

fun bucketMix(hitGravity: Int): BucketMix {
    val amount = hitGravity / PERCENT_SCALE
    return BucketMix(
        power = lerp(POWER_AT_MIN_GRAVITY, POWER_AT_MAX_GRAVITY, amount),
        current = lerp(CURRENT_AT_MIN_GRAVITY, CURRENT_AT_MAX_GRAVITY, amount),
        recurrent = lerp(RECURRENT_AT_MIN_GRAVITY, RECURRENT_AT_MAX_GRAVITY, amount),
    )
}

fun separationWindows(separation: Int): SeparationWindows {
    val amount = separation / PERCENT_SCALE
    return SeparationWindows(
        artistMs = lerp(ARTIST_MIN_MS, ARTIST_MAX_MS, amount) * MS_PER_MINUTE,
        titleMs = mapOf(
            "power" to lerp(POWER_TITLE_MIN_MINUTES, POWER_TITLE_MAX_MINUTES, amount) * MS_PER_MINUTE,
            "current" to lerp(
                CURRENT_TITLE_MIN_MINUTES * SECONDS_PER_MINUTE,
                CURRENT_TITLE_MAX_MINUTES * SECONDS_PER_MINUTE,
                amount,
            ) * MS_PER_MINUTE,
            "recurrent" to lerp(
                RECURRENT_TITLE_MIN_MINUTES * SECONDS_PER_MINUTE,
                RECURRENT_TITLE_MAX_MINUTES * SECONDS_PER_MINUTE,
                amount,
            ) * MS_PER_MINUTE,
            "gold" to lerp(
                GOLD_TITLE_MIN_MINUTES * SECONDS_PER_MINUTE,
                GOLD_TITLE_MAX_MINUTES * SECONDS_PER_MINUTE,
                amount,
            ) * MS_PER_MINUTE,
        ),
    )
}

fun dueScore(track: Track, now: Long, lastPlay: Long?): Double {
    val wait = if (lastPlay == null) WEEK_MS.toDouble() else (now - lastPlay).toDouble()
    return wait * (1 + 1.0 / track.rank)
}

fun orbitPolicy(weights: Weights): OrbitPolicy {
    val orbitMs = weights.powerOrbitMin * 60_000.0
    return OrbitPolicy(minMs = 0.7 * orbitMs, forceMs = 0.85 * orbitMs)
}
