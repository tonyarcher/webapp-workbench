package radioapi.domain

/** Sliders run 0..100, where 100 means "disable this guard entirely". */
private const val PERCENT_MAX = 100

/** A recent artist play still counts as recent at half the artist window. */
private const val ARTIST_WINDOW_HALVED = 0.5

fun shouldForceNumberOne(
    track: Track?,
    now: Long,
    weekStart: Long,
    lastByTrack: Map<String, Long>,
    lastByArtist: Map<String, Long>,
    windows: SeparationWindows,
    orbit: OrbitPolicy,
    goldLeak: Int,
): Boolean {
    if (track == null || goldLeak >= PERCENT_MAX) return false
    val last = lastByTrack[track.id]
    val since = if (last == null) now - weekStart else now - last
    if (since < orbit.forceMs) return false
    if (last != null && now - last < orbit.minMs) return false
    val artistLast = lastByArtist[track.artist]
    if (artistLast != null && now - artistLast < windows.artistMs * ARTIST_WINDOW_HALVED) return false
    return true
}
