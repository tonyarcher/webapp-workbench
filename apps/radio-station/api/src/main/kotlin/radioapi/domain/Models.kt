package radioapi.domain

const val WEEK_MS: Long = 7L * 24 * 60 * 60 * 1_000

data class Weights(
    val hitGravity: Int,
    val goldLeak: Int,
    val temperature: Int,
    val separation: Int,
    val powerOrbitMin: Int,
)

data class Track(
    val id: String,
    val artist: String,
    val title: String,
    val durationMs: Int,
    val year: Int,
    val genre: String,
    val era: String,
    val rotation: String,
    val rank: Int,
    val explicit: Boolean,
    val radioEdit: Boolean,
)

data class ScheduledEntry(
    val trackId: String,
    val artist: String,
    val title: String,
    val startsAtMs: Long,
    val durationMs: Int,
    val rotation: String,
    val era: String,
    val rank: Int,
)
