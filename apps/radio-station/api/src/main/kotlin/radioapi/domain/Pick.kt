package radioapi.domain

private const val GOLD_2000S_SHARE = 0.6
private val RELAX_STEPS = listOf(0.0, 0.2, 0.4, 0.6, 0.8, 1.0)

fun chooseBucket(rng: Rng, weights: Weights): String {
    if (rng.next() < weights.goldLeak / 100.0) {
        return if (rng.next() < GOLD_2000S_SHARE) "gold2000s" else "gold1990s"
    }
    val mix = bucketMix(weights.hitGravity)
    return pickWeighted(rng, listOf("power", "current", "recurrent"), listOf(mix.power, mix.current, mix.recurrent))
}

fun passesSeparation(
    track: Track,
    now: Long,
    lastByTrack: Map<String, Long>,
    lastByArtist: Map<String, Long>,
    windows: SeparationWindows,
    relax: Double,
    orbitMinMs: Double = 0.0,
    numberOneId: String? = null,
): Boolean {
    val scale = 1 - relax
    val artistLast = lastByArtist[track.artist]
    if (artistLast != null && now - artistLast < windows.artistMs * scale) return false
    val titleLast = lastByTrack[track.id]
    val titleWindow = windows.titleMs[track.rotation] ?: 0.0
    if (titleLast != null && now - titleLast < titleWindow * scale) return false
    return !orbitBlocks(track, now, titleLast, orbitMinMs, numberOneId)
}

fun pickFromBucket(
    rng: Rng,
    buckets: TrackBuckets,
    name: String,
    now: Long,
    lastByTrack: Map<String, Long>,
    lastByArtist: Map<String, Long>,
    windows: SeparationWindows,
    temperature: Int,
    orbitMinMs: Double = 0.0,
    numberOneId: String? = null,
): Track {
    val pool = buckets.named(name).ifEmpty { buckets.all() }
    val fit = eligible(pool, now, lastByTrack, lastByArtist, windows, orbitMinMs, numberOneId)
    if (fit.size == 1) return fit.first()
    if (temperature >= 100) return pickUniform(rng, fit)
    return pickByTemperature(rng, fit, now, lastByTrack, temperature)
}

private fun orbitBlocks(
    track: Track,
    now: Long,
    titleLast: Long?,
    orbitMinMs: Double,
    numberOneId: String?,
): Boolean {
    if (numberOneId == null || track.id != numberOneId || titleLast == null) return false
    return now - titleLast < orbitMinMs
}

private fun eligible(
    pool: List<Track>,
    now: Long,
    lastByTrack: Map<String, Long>,
    lastByArtist: Map<String, Long>,
    windows: SeparationWindows,
    orbitMinMs: Double,
    numberOneId: String?,
): List<Track> {
    val preferred = withoutLastArtist(pool, lastByArtist)
    val relaxed = firstRelaxed(preferred, now, lastByTrack, lastByArtist, windows, orbitMinMs, numberOneId)
    if (relaxed.isNotEmpty()) return relaxed
    val others = pool.filter { it.id != numberOneId }
    return others.ifEmpty { pool }
}

private fun firstRelaxed(
    pool: List<Track>,
    now: Long,
    lastByTrack: Map<String, Long>,
    lastByArtist: Map<String, Long>,
    windows: SeparationWindows,
    orbitMinMs: Double,
    numberOneId: String?,
): List<Track> {
    for (relax in RELAX_STEPS) {
        val found = separated(pool, now, lastByTrack, lastByArtist, windows, relax, orbitMinMs, numberOneId)
        if (found.isNotEmpty()) return found
    }
    return separated(pool, now, lastByTrack, lastByArtist, windows, 1.0, orbitMinMs, numberOneId)
}

private fun separated(
    pool: List<Track>,
    now: Long,
    lastByTrack: Map<String, Long>,
    lastByArtist: Map<String, Long>,
    windows: SeparationWindows,
    relax: Double,
    orbitMinMs: Double,
    numberOneId: String?,
): List<Track> = pool.filter { track ->
    passesSeparation(track, now, lastByTrack, lastByArtist, windows, relax, orbitMinMs, numberOneId)
}

private fun withoutLastArtist(pool: List<Track>, lastByArtist: Map<String, Long>): List<Track> {
    val last = lastByArtist.maxByOrNull { it.value } ?: return pool
    val skipped = pool.filter { it.artist != last.key }
    return skipped.ifEmpty { pool }
}

private fun pickByTemperature(
    rng: Rng,
    pool: List<Track>,
    now: Long,
    lastByTrack: Map<String, Long>,
    temperature: Int,
): Track {
    if (temperature <= 0) return mostDue(pool, now, lastByTrack)
    val exp = 1 - 0.99 * (temperature / 100.0)
    val weights = pool.map { track ->
        val score = dueScore(track, now, lastByTrack[track.id]).coerceAtLeast(1.0)
        Math.pow(score, exp)
    }
    return pickWeighted(rng, pool, weights)
}

private fun mostDue(pool: List<Track>, now: Long, lastByTrack: Map<String, Long>): Track {
    var best = pool.first()
    var bestScore = dueScore(best, now, lastByTrack[best.id])
    for (track in pool.drop(1)) {
        val score = dueScore(track, now, lastByTrack[track.id])
        if (score > bestScore) {
            best = track
            bestScore = score
        }
    }
    return best
}
