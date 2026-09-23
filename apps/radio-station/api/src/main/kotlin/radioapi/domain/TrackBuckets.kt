package radioapi.domain

data class TrackBuckets(
    val power: List<Track>,
    val current: List<Track>,
    val recurrent: List<Track>,
    val gold2000s: List<Track>,
    val gold1990s: List<Track>,
) {
    fun named(name: String): List<Track> = when (name) {
        "power" -> power
        "current" -> current
        "recurrent" -> recurrent
        "gold2000s" -> gold2000s
        else -> gold1990s
    }

    fun all(): List<Track> = power + current + recurrent + gold2000s + gold1990s
}

fun groupTracks(tracks: List<Track>): TrackBuckets {
    val power = mutableListOf<Track>()
    val current = mutableListOf<Track>()
    val recurrent = mutableListOf<Track>()
    val gold2000s = mutableListOf<Track>()
    val gold1990s = mutableListOf<Track>()
    for (track in tracks) {
        when {
            track.rotation == "power" -> power.add(track)
            track.rotation == "current" -> current.add(track)
            track.rotation == "recurrent" -> recurrent.add(track)
            track.era == "gold-2000s" -> gold2000s.add(track)
            else -> gold1990s.add(track)
        }
    }
    return TrackBuckets(power, current, recurrent, gold2000s, gold1990s)
}

fun numberOne(buckets: TrackBuckets): Track? = buckets.power.find { it.rank == 1 } ?: buckets.power.firstOrNull()
