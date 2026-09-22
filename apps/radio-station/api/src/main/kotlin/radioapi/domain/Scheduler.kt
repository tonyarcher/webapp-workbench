package radioapi.domain

fun generateWeek(tracks: List<Track>, seed: String, startsAtMs: Long, weights: Weights): List<ScheduledEntry> {
    if (tracks.isEmpty()) error("catalog is empty")
    if (tracks.any { it.durationMs <= 0 }) error("catalog has a zero-duration track")
    val rng = Rng(seed)
    val clock = buildClock(tracks, startsAtMs, weights)
    return fillWeek(rng, clock, startsAtMs)
}

private fun fillWeek(rng: Rng, clock: ClockState, startsAtMs: Long): List<ScheduledEntry> {
    val lastByTrack = mutableMapOf<String, Long>()
    val lastByArtist = mutableMapOf<String, Long>()
    val entries = mutableListOf<ScheduledEntry>()
    var now = startsAtMs
    val end = startsAtMs + WEEK_MS
    while (now < end) {
        val track = nextTrack(rng, clock, now, lastByTrack, lastByArtist)
        entries.add(toEntry(track, now))
        lastByTrack[track.id] = now
        lastByArtist[track.artist] = now
        now += track.durationMs
    }
    return entries
}

private fun nextTrack(
    rng: Rng,
    clock: ClockState,
    now: Long,
    lastByTrack: Map<String, Long>,
    lastByArtist: Map<String, Long>,
): Track {
    val forced = clock.top
    if (shouldForce(clock, now, lastByTrack, lastByArtist) && forced != null) return forced
    val bucket = chooseBucket(rng, clock.weights)
    return pickFromBucket(
        rng,
        clock.buckets,
        bucket,
        now,
        lastByTrack,
        lastByArtist,
        clock.windows,
        clock.weights.temperature,
        clock.orbit.minMs,
        forced?.id,
    )
}

private fun shouldForce(
    clock: ClockState,
    now: Long,
    lastByTrack: Map<String, Long>,
    lastByArtist: Map<String, Long>,
): Boolean = shouldForceNumberOne(
    clock.top,
    now,
    clock.weekStart,
    lastByTrack,
    lastByArtist,
    clock.windows,
    clock.orbit,
    clock.weights.goldLeak,
)

private fun toEntry(track: Track, startsAtMs: Long): ScheduledEntry = ScheduledEntry(
    trackId = track.id,
    artist = track.artist,
    title = track.title,
    startsAtMs = startsAtMs,
    durationMs = track.durationMs,
    rotation = track.rotation,
    era = track.era,
    rank = track.rank,
)

private data class ClockState(
    val buckets: TrackBuckets,
    val windows: SeparationWindows,
    val orbit: OrbitPolicy,
    val top: Track?,
    val weights: Weights,
    val weekStart: Long,
)

private fun buildClock(tracks: List<Track>, startsAtMs: Long, weights: Weights): ClockState {
    val buckets = groupTracks(tracks)
    return ClockState(
        buckets,
        separationWindows(weights.separation),
        orbitPolicy(weights),
        numberOne(buckets),
        weights,
        startsAtMs,
    )
}
