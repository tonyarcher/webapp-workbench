package radioapi.domain

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
    if (track == null || goldLeak >= 100) return false
    val last = lastByTrack[track.id]
    val since = if (last == null) now - weekStart else now - last
    if (since < orbit.forceMs) return false
    if (last != null && now - last < orbit.minMs) return false
    val artistLast = lastByArtist[track.artist]
    if (artistLast != null && now - artistLast < windows.artistMs * 0.5) return false
    return true
}
