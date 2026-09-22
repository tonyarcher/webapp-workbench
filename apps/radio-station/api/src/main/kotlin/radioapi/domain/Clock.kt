package radioapi.domain

data class BucketMix(val power: Double, val current: Double, val recurrent: Double)

data class SeparationWindows(val artistMs: Double, val titleMs: Map<String, Double>)

data class OrbitPolicy(val minMs: Double, val forceMs: Double)

fun lerp(start: Double, end: Double, amount: Double): Double = start + (end - start) * amount

fun bucketMix(hitGravity: Int): BucketMix {
    val amount = hitGravity / 100.0
    return BucketMix(
        power = lerp(0.15, 0.45, amount),
        current = lerp(0.25, 0.45, amount),
        recurrent = lerp(0.50, 0.10, amount),
    )
}

fun separationWindows(separation: Int): SeparationWindows {
    val amount = separation / 100.0
    return SeparationWindows(
        artistMs = lerp(8.0, 45.0, amount) * 60_000,
        titleMs = mapOf(
            "power" to lerp(40.0, 100.0, amount) * 60_000,
            "current" to lerp(2.0 * 60, 5.0 * 60, amount) * 60_000,
            "recurrent" to lerp(6.0 * 60, 14.0 * 60, amount) * 60_000,
            "gold" to lerp(8.0 * 60, 24.0 * 60, amount) * 60_000,
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
